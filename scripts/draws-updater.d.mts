export declare const DATA_FILE: string
export declare function updateDraws(opts?: { log?: (msg: string) => void }): Promise<{
  added: number
  latest: number
  updatedAt: string
}>
