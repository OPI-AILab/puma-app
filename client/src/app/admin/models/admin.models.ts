export interface AdminUser {
  id: number;
  username: string;
}

export interface LangSetting {
  lang: string;
}

export interface OrphanFilesScan {
  orphanFiles: string[];
  ghostRecords: string[];
  orphanCount: number;
  ghostCount: number;
}

export interface OrphanFilesCleanupResult {
  deletedFiles: number;
  deletedRecords: number;
}
