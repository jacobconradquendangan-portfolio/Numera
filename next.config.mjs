/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'xlsx', 'tesseract.js'],
  outputFileTracingIncludes: {
    '/api/analyze': ['./node_modules/tesseract.js-core/*.wasm'],
  },
  allowedDevOrigins: ['192.168.100.152'],
};

export default nextConfig;
