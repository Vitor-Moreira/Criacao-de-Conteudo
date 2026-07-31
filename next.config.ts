import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Abaixo do teto de 4.5MB imposto pela infraestrutura serverless da Vercel
      // para o corpo de Server Actions, deixando margem para o overhead do
      // multipart/form-data no upload de arquivos em /melhorar-conteudo.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
