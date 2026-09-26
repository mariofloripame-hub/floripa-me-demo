/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-server child-process rendering workers ("Jest worker encountered N
  // child process exceptions") were crashing under low system memory.
  // Running the compiler in a single worker avoids spawning extra child
  // processes that can fail to start when RAM is tight.
  experimental: {
    cpus: 1,
  },
  images: {
    remotePatterns: [
      // Self-signup establishment photos, uploaded to the public
      // `establishment-photos` Supabase Storage bucket.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
