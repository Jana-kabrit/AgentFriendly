import { randomUUID } from "node:crypto";

import type { AgentContext } from "../types/agent-context.js";

/**
 * Layer 6 — AHP MODE3 Task Queue
 *
 * Manages asynchronous task execution for AHP MODE3 (Agentic Desk).
 *
 * Flow:
 * 1. Agent POSTs to /agent/task with a task name, args, and optional webhook URL
 * 2. The task queue creates a task record with status "pending"
 * 3. The handler runs in the background (non-blocking)
 * 4. When complete, the status is updated to "completed" or "failed"
 * 5. If a webhook URL was provided, the result is POSTed to it
 * 6. The agent can poll GET /agent/task/:id to check the status at any time
 *
 * Storage: In-memory Map (suitable for development and single-instance production).
 * For distributed deployments, the Hono adapter uses Cloudflare Queues.
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  readonly id: string;
  readonly taskName: string;
  readonly args: Record<string, unknown>;
  readonly webhookUrl: string | null;
  readonly submittedAt: string;
  readonly agentId: string | null;
  readonly tenantId: string | null;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export class InMemoryTaskQueue {
  private readonly tasks = new Map<string, Task>();
  private readonly retentionMs: number;

  constructor(retentionSeconds: number = 86400) {
    this.retentionMs = retentionSeconds * 1000;
  }

  /**
   * Enqueue a new task. Returns the task record immediately (202 Accepted).
   * The handler runs in the background without blocking the HTTP response.
   */
  async enqueue(
    taskName: string,
    args: Record<string, unknown>,
    handler: (args: Record<string, unknown>, context: AgentContext) => Promise<Record<string, unknown>>,
    context: AgentContext,
    webhookUrl?: string,
  ): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      taskName,
      args,
      webhookUrl: webhookUrl ?? null,
      submittedAt: new Date().toISOString(),
      agentId: context.verifiedIdentity?.agentId ?? null,
      tenantId: context.tenantContext?.tenantId ?? null,
      status: "pending",
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    this.tasks.set(task.id, task);

    // Run handler in background — do not await
    this.runHandler(task, handler, context);

    return task;
  }

  private async runHandler(
    task: Task,
    handler: (args: Record<string, unknown>, context: AgentContext) => Promise<Record<string, unknown>>,
    context: AgentContext,
  ): Promise<void> {
    task.status = "running";
    task.startedAt = new Date().toISOString();

    try {
      const result = await handler(task.args, context);
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      task.result = result;

      if (task.webhookUrl) {
        await this.callWebhook(task);
      }

      // Schedule cleanup after retention period
      setTimeout(() => this.tasks.delete(task.id), this.retentionMs);
    } catch (error) {
      task.status = "failed";
      task.completedAt = new Date().toISOString();
      task.error = error instanceof Error ? error.message : String(error);

      if (task.webhookUrl) {
        await this.callWebhook(task);
      }
    }
  }

  private async callWebhook(task: Task): Promise<void> {
    if (!task.webhookUrl) return;
    try {
      await fetch(task.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          taskName: task.taskName,
          status: task.status,
          result: task.result,
          error: task.error,
          completedAt: task.completedAt,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.warn(
        `[@agentfriendly/tools] Webhook ${task.webhookUrl} failed for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Get the current status and result of a task by ID. */
  getTask(id: string): Task | null {
    return this.tasks.get(id) ?? null;
  }

  /** Get all tasks (for admin/debug purposes). */
  getAllTasks(): readonly Task[] {
    return [...this.tasks.values()];
  }
}
