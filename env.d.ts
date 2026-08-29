declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    ASAAS_API_KEY?: string;
    ASAAS_WEBHOOK_TOKEN?: string;
  }
}
