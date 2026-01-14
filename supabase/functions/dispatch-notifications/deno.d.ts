// Type declarations for Deno Edge Function
/// <reference lib="deno.ns" />

// Deno global namespace
declare namespace Deno {
    export namespace env {
        export function get(key: string): string | undefined;
    }
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
    export function serve(
        handler: (request: Request) => Response | Promise<Response>,
        options?: { port?: number; hostname?: string }
    ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.7.1" {
    export function createClient(
        supabaseUrl: string,
        supabaseKey: string,
        options?: any
    ): any;
}

declare module "https://esm.sh/resend@1.0.0" {
    export class Resend {
        constructor(apiKey: string);
        emails: {
            send(params: {
                from: string;
                to: string;
                subject: string;
                html: string;
            }): Promise<any>;
        };
    }
}

declare module "https://esm.sh/twilio@3.84.0" {
    export default class Twilio {
        constructor(accountSid: string, authToken: string);
        messages: {
            create(params: {
                body: string;
                from: string;
                to: string;
            }): Promise<any>;
        };
    }
}
