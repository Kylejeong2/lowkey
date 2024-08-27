import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import cors from 'cors';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Use cors middleware
    cors()(req, res, () => {
      const parsedUrl = parse(req.url || '', true);
      handle(req, res, parsedUrl);
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});