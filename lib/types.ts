export type RenderingIntent = "relative" | "perceptual" | "saturation" | "absolute";

export interface ProfileInfo {
  name: string;
  path: string;
  description?: string;
  deviceClass?: string;
  colorSpace?: string;
  channels?: number;
  userProvided?: boolean;
}

export interface AnalysisSettings {
  inputProfilePath?: string;
  outputProfilePath: string;
  renderingIntent: RenderingIntent;
  blackPointCompensation: boolean;
  maxSize: number;
  deltaEThresholds: [number, number];
  tacLimit?: number;
  rankWeights?: { p95: number; mean: number };
}

export interface AnalysisResult {
  profile: ProfileInfo;
  settings: AnalysisSettings;
  stats: {
    mean_de: number;
    p95_de: number;
    max_de: number;
    pct_de_gt_t1: number;
    pct_de_gt_t2: number;
    rank_score: number;
  };
  tac: {
    supported: boolean;
    limit?: number;
    pct_gt_limit?: number;
    p95?: number;
    max?: number;
  };
  previews: {
    de_heatmap_png_base64?: string;
    mask_png_base64?: string;
  };
  error?: string;
}

export interface ApiError {
  message: string;
  detail?: string;
}
