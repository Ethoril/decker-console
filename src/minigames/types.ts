export interface MiniGameProps<P, G> {
  params: P;
  onProgress: (progress: G) => void;
  onResult: (won: boolean) => void;
}
