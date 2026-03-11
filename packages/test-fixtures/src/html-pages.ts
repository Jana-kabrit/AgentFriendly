/**
 * Sample HTML pages for content conversion tests.
 */
export const HTML = {
  minimal: `<!DOCTYPE html>
<html lang="en">
  <head><title>Hello World</title></head>
  <body>
    <h1>Hello World</h1>
    <p>Welcome to our website.</p>
  </body>
</html>`,

  withNoise: `<!DOCTYPE html>
<html lang="en">
  <head><title>Product Page</title><meta charset="utf-8"></head>
  <body>
    <nav>Home | Products | About</nav>
    <header>My Site — Your #1 Source</header>
    <main>
      <h1>Amazing Product</h1>
      <p>This product will <strong>change your life</strong>.</p>
      <p>Price: $49.99</p>
    </main>
    <aside class="ads">Buy gold now!</aside>
    <footer>Copyright 2026 MySite Inc.</footer>
    <script>console.log("noise")</script>
    <style>.hidden { display: none }</style>
  </body>
</html>`,

  withPii: `<!DOCTYPE html>
<html>
  <head><title>Profile</title></head>
  <body>
    <h1>User Profile</h1>
    <p>Email: user@example.com</p>
    <p>Phone: 555-123-4567</p>
    <p>SSN: 123-45-6789</p>
  </body>
</html>`,

  withCode: `<!DOCTYPE html>
<html>
  <head><title>Docs</title></head>
  <body>
    <main>
      <h1>API Reference</h1>
      <p>Use the following code snippet:</p>
      <pre><code>const x = 42;\nconsole.log(x);</code></pre>
    </main>
  </body>
</html>`,
} as const;
