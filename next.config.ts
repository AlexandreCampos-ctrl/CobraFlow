import type { NextConfig } from 'next';

const securityHeaders=[
  {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; upgrade-insecure-requests"},
  {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
  {key:'X-XSS-Protection',value:'0'},
];
const nextConfig: NextConfig = {async headers(){return[
  {source:'/:path*',headers:securityHeaders},
  {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]},
  {source:'/app/:path*',headers:[{key:'Cache-Control',value:'no-store'}]},
  {source:'/pagar/:path*',headers:[{key:'Cache-Control',value:'no-store'}]},
]}};

export default nextConfig;
