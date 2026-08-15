import { createServer } from "node:https";
import { request as requestHttp } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const certificatePath = resolve(root, ".certs", "zxt-mobile-lan.pfx");
const port = Number(process.env.MOBILE_HTTPS_PORT || 3443);
const networkHost = Object.entries(networkInterfaces())
  .flatMap(([name, entries]) =>
    entries
      .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
      .map((entry) => ({ name, address: entry.address })),
  )
  .find(({ name }) => !/vEthernet|WSL|Hyper-V|Loopback/i.test(name))?.address;
const host = process.env.MOBILE_HTTPS_HOST || networkHost || "localhost";

if (!existsSync(certificatePath)) {
  throw new Error(`未找到 HTTPS 证书：${certificatePath}`);
}

const proxy = createServer({ pfx: readFileSync(certificatePath) }, (req, res) => {
  const upstream = requestHttp(
    {
      hostname: "127.0.0.1",
      port: 3100,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: "127.0.0.1:3100",
        "x-forwarded-proto": "https",
        "x-forwarded-host": req.headers.host || "",
      },
    },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end(`移动端服务不可用：${error.message}`);
  });
  req.pipe(upstream);
});

proxy.listen(port, "0.0.0.0", () => {
  console.log(`Mobile HTTPS proxy ready at https://${host}:${port}`);
});
