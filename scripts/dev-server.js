#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildQuizCatalog } = require('./quiz-catalog');

const projectRoot = process.cwd();
const port = Number(process.env.PORT || 8000);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function send(response, status, contentType, body) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === '/data/quiz-manifest.json') {
    try {
      send(response, 200, mimeTypes['.json'], JSON.stringify(buildQuizCatalog(projectRoot)));
    } catch (error) {
      send(response, 500, mimeTypes['.json'], JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(projectRoot, `.${decodedPath}`);

  if (!filePath.startsWith(`${projectRoot}${path.sep}`) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(response, 404, 'text/plain; charset=utf-8', 'Not found');
    return;
  }

  send(
    response,
    200,
    mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    fs.readFileSync(filePath)
  );
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Quiz app: http://127.0.0.1:${port}`);
  console.log('The quiz catalog refreshes automatically when JSON files change.');
});
