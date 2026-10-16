/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'xlsx'],
  allowedDevOrigins: ['192.168.100.152'],
};

export default nextConfig;
