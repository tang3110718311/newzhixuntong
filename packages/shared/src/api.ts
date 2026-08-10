export type ApiSuccess<T> = {
  success: true;
  code: "OK";
  message: string;
  traceId: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  code: string;
  message: string;
  traceId: string;
  data?: null;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  name: string;
  mobile: string;
  email: string | null;
  roleCode: string;
  status: string;
  orgId: string | null;
  orgName: string | null;
  passwordMustChange: number;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};
export type DashboardOverview = {
  tenantName: string;
  industryPackageCount: number;
  sceneCount: number;
  publishedTaskCount: number;
  completedTaskCount: number;
  trainingRecordCount: number;
  trainingPassRate: number;
  examAttemptCount: number;
  examPassRate: number;
  averageTrainingScore: number;
  aiUsage: {
    tokenCount: number;
    sttSeconds: number;
    ttsCharacters: number;
  };
  todos: Array<{ label: string; count: number; href: string }>;
  pendingTaskCount: number;
  studyDurationHours: number;
  points: number;
  monthProgress: number;
};
