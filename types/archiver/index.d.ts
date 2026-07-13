declare module "archiver" {
  import { Transform } from "node:stream";
  export class ZipArchive extends Transform {
    constructor(options?: { zlib?: { level?: number } });
    directory(path: string, destination: string): this;
    finalize(): Promise<void>;
  }
}
