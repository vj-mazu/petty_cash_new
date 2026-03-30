import axios, { type AxiosRequestConfig } from 'axios';

// Extend Axios types to include our custom properties
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  validateStatus: function (status) {
    return (status >= 200 && status < 300) || status === 304;
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this request should skip auto-redirect (for EditAnamath)
      const skipRedirect = error.config?.skipAuthRedirect;

      if (!skipRedirect) {
        // Token expired or invalid - redirect to login
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        // Skip redirect but log the auth failure
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'owner' | 'manager' | 'staff';
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;               // API success flag
  message?: string;               // Optional human readable message
  data?: T;                       // Payload container
  errors?: any[];                 // Validation or domain errors
  transactionNumber?: number;     // (Optional) sequential number when directly returned
  displayTransactionNumber?: string; // (Optional) formatted version
}

export interface Ledger {
  id: string;
  name: string;
  description?: string;
  currentBalance: number;
  ledgerType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  creator?: User;
}

export interface CreateLedgerData {
  name: string;
  description?: string;
  ledgerType?: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}

export interface Transaction {
  id: string;
  date: string;
  reference?: string;
  debitAmount: number;
  creditAmount: number;
  ledgerId: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  ledger?: Ledger;
  creator?: User;
  transactionNumber?: number; // newly added sequential number
  displayTransactionNumber?: string; // formatted with leading zeros
  type?: 'debit' | 'credit' | 'anamath';
  transactionType?: 'regular' | 'combined';
  referenceNumber?: string;
  remarks?: string;
  isSuspended?: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface CreateTransactionData {
  ledgerId?: string;  // Made optional for Anamath entries
  reference?: string;
  debitAmount?: number;
  creditAmount?: number;
  date?: string;
  type?: 'debit' | 'credit' | 'anamath';
  amount?: number;
  remarks?: string; // This is for the main transaction, not anamath
  transactionType?: 'regular' | 'combined';
  referenceNumber?: string;

  // New fields for combined transactions
  anamathAmount?: number;
  anamathRemarks?: string;
  anamathLedgerId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[];
  } & {
    pagination: {
      total: number;
      page: number;
      pages: number;
      limit: number;
    };
  };
}

export interface SystemSetting {
  key: string;
  value: any;
  dataType: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  updatedAt?: string;
}

export interface AnamathEntry {
  id: string;
  date: string;
  amount: number;
  remarks: string;
  ledgerId?: string;
  referenceNumber?: string;
  transactionNumber?: number;
  displayTransactionNumber?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  ledger?: Ledger;
  creator?: User;
  isClosed?: boolean;
  closedAt?: string;
  closedBy?: string;
  closedByUser?: User;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface CreateAnamathEntryData {
  date: string;
  amount: number;
  remarks: string;
  ledgerId?: string;
  referenceNumber?: string;
  transactionNumber?: number; // Added this line
}

// Auth API
export const authApi = {
  login: async (data: { username: string; password: string }): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email: data.username, password: data.password });
    return response.data as AuthResponse;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data as AuthResponse;
  },

  getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/profile');
    return response.data as ApiResponse<{ user: User }>;
  },

  updateProfile: async (data: Partial<User>): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put('/auth/profile', data);
    return response.data as ApiResponse<{ user: User }>;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse> => {
    const response = await api.put('/auth/change-password', data);
    return response.data as ApiResponse;
  },

  getAllUsers: async (params?: PaginationParams): Promise<PaginatedResponse<User>> => {
    const response = await api.get('/auth/users', { params });
    return response.data as PaginatedResponse<User>;
  },

  updateUserRole: async (userId: string, data: { role: string; isActive: boolean }): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.put(`/auth/users/${userId}/role`, data);
    return response.data as ApiResponse<{ user: User }>;
  }
};

// Ledger API
export const ledgerApi = {
  create: async (data: CreateLedgerData): Promise<ApiResponse<{ ledger: Ledger }>> => {
    const response = await api.post('/ledgers', data);
    return response.data as ApiResponse<{ ledger: Ledger }>;
  },

  getAll: async (params?: PaginationParams & { ledgerType?: string }): Promise<PaginatedResponse<Ledger>> => {
    const response = await api.get('/ledgers', { params });
    return response.data as PaginatedResponse<Ledger>;
  },

  getById: async (id: string): Promise<ApiResponse<{ ledger: Ledger }>> => {
    const response = await api.get(`/ledgers/${id}`);
    return response.data as ApiResponse<{ ledger: Ledger }>;
  },

  update: async (id: string, data: Partial<CreateLedgerData>): Promise<ApiResponse<{ ledger: Ledger }>> => {
    const response = await api.put(`/ledgers/${id}`, data);
    return response.data as ApiResponse<{ ledger: Ledger }>;
  },

  delete: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/ledgers/${id}`);
    return response.data as ApiResponse;
  },

  getSummary: async (): Promise<ApiResponse<{ summary: any; ledgers: Ledger[] }>> => {
    const response = await api.get('/ledgers/summary');
    return response.data as ApiResponse<{ summary: any; ledgers: Ledger[] }>;
  },

  getLedgerSummaries: async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<any>> => {
    const response = await api.get('/ledgers/summaries', { params });
    return response.data as ApiResponse<any>;
  }
};

// Transaction API
export const transactionApi = {
  create: async (data: CreateTransactionData): Promise<ApiResponse<{ transaction: Transaction; newLedgerBalance: number }>> => {
    const response = await api.post('/transactions', data);
    return response.data as ApiResponse<{ transaction: Transaction; newLedgerBalance: number }>;
  },

  getAll: async (params?: PaginationParams & {
    ledgerId?: string;
    startDate?: string;
    endDate?: string;
    type?: 'debit' | 'credit';
    txNumber?: string; // Added txNumber parameter
    includeSuspended?: string; // Include suspended transactions ('true' or 'false')
  }): Promise<PaginatedResponse<Transaction> & { data: { totals: { totalDebit: number; totalCredit: number } } }> => {
    // Log the parameters being sent for debugging
    // Default UI requests should avoid an expensive COUNT(*) unless caller requests totals
    const pAny: any = params || {};
    const defaultParams = {
      ...pAny,
      no_count: pAny.no_count ?? 'true'
    } as any;

    // Map frontend txNumber -> backend tx_number for faster exact-match when numeric
    if (defaultParams.txNumber !== undefined) {
      defaultParams.tx_number = defaultParams.txNumber;
      delete defaultParams.txNumber;
    }

    const response = await api.get('/transactions', { params: defaultParams });
    return response.data as PaginatedResponse<Transaction> & { data: { totals: { totalDebit: number; totalCredit: number } } };
  },

  getById: async (id: string): Promise<ApiResponse<{ transaction: Transaction }>> => {
    const response = await api.get(`/transactions/${id}`);
    return response.data as ApiResponse<{ transaction: Transaction }>;
  },

  getNextNumber: async (): Promise<ApiResponse<{ nextTransactionNumber: number }>> => {
    const response = await api.get('/transactions/next-number');
    return response.data as ApiResponse<{ nextTransactionNumber: number }>;
  },

  update: async (id: string, data: Partial<CreateTransactionData>): Promise<ApiResponse<{ transaction: Transaction; newLedgerBalance: number; balanceChange?: string }>> => {
    try {

      if (!id) {
        throw new Error('Missing transaction ID');
      }

      // Optional UUID format warning (do not block request)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
      }

      // Preserve explicit zero values; only drop truly undefined
      const normalizeAmount = (val: any) => {
        if (val === undefined || val === null || val === '') return undefined;
        const n = parseFloat(val.toString());
        return isNaN(n) ? undefined : n;
      };

      // Avoid converting plain date (yyyy-mm-dd) to ISO to prevent timezone shift
      const normalizeDate = (val: any) => {
        if (!val) return undefined;
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return val; // keep as simple date string
        }
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) return d.toISOString();
        } catch { }
        return undefined;
      };

      const cleanData: any = {
        ...data,
        remarks: data.remarks?.trim(),
        reference: data.reference?.trim() || null,
        debitAmount: normalizeAmount(data.debitAmount),
        creditAmount: normalizeAmount(data.creditAmount),
        date: normalizeDate(data.date)
      };

      Object.keys(cleanData).forEach(k => {
        if (cleanData[k] === undefined) delete cleanData[k];
      });


      const response = await api.put(`/transactions/${id}`, cleanData);

      return response.data as ApiResponse<{ transaction: Transaction; newLedgerBalance: number; balanceChange?: string }>;
    } catch (error: any) {
      console.error('Transaction update API error:', error);

      // Re-throw with enhanced error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }

      throw error;
    }
  },

  delete: async (id: string): Promise<ApiResponse<{ newLedgerBalance: number; deletedTransaction?: any }>> => {
    try {
      if (!id) {
        throw new Error('Missing transaction ID');
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
      }

      const response = await api.delete(`/transactions/${id}`);

      return response.data as ApiResponse<{ newLedgerBalance: number; deletedTransaction?: any }>;
    } catch (error: any) {
      console.error('Transaction delete API error:', error);

      // Re-throw with enhanced error information
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }

      throw error;
    }
  },

  suspend: async (id: string, reason?: string): Promise<ApiResponse<{ transactionId: string; suspendedAt: string; reason: string }>> => {
    try {
      if (!id) {
        throw new Error('Missing transaction ID');
      }

      const response = await api.patch(`/transactions/${id}/suspend`, { reason });

      return response.data as ApiResponse<{ transactionId: string; suspendedAt: string; reason: string }>;
    } catch (error: any) {
      console.error('Transaction suspend API error:', error);

      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }

      throw error;
    }
  },

  unsuspend: async (id: string, reason?: string): Promise<ApiResponse<{ transactionId: string; unsuspendedAt: string; reason: string }>> => {
    try {
      if (!id) {
        throw new Error('Missing transaction ID');
      }

      const response = await api.patch(`/transactions/${id}/unsuspend`, { reason });

      return response.data as ApiResponse<{ transactionId: string; unsuspendedAt: string; reason: string }>;
    } catch (error: any) {
      console.error('Transaction unsuspend API error:', error);

      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }

      throw error;
    }
  },

  getStats: async (params?: {
    ledgerId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ stats: any }>> => {
    const response = await api.get('/transactions/stats', { params });
    return response.data as ApiResponse<{ stats: any }>;
  },

  getBusinessBalances: async (): Promise<ApiResponse<{
    businessDate: string;
    openingBalance: number;
    closingBalance: number;
    isBeforeSixAM: boolean;
  }>> => {
    const response = await api.get('/transactions/business-balances');
    return response.data as ApiResponse<{
      businessDate: string;
      openingBalance: number;
      closingBalance: number;
      isBeforeSixAM: boolean;
    }>;
  },

  // Get opening/closing balances for a specific date (YYYY-MM-DD)
  getBalances: async (date: string): Promise<ApiResponse<{
    date: string;
    openingBalance: number;
    closingBalance: number;
  }>> => {
    const response = await api.get('/transactions/balances', { params: { date } });
    return response.data as ApiResponse<{ date: string; openingBalance: number; closingBalance: number }>;
  },

  getBulkBalances: async (dates: string[]): Promise<ApiResponse<{ balances: Record<string, number> }>> => {
    const response = await api.get('/transactions/bulk-balances', { params: { dates: dates.join(',') } });
    return response.data as ApiResponse<{ balances: Record<string, number> }>;
  },

  approve: async (id: string): Promise<ApiResponse> => {
    const response = await api.post(`/transactions/${id}/approve`);
    return response.data as ApiResponse;
  },

  reject: async (id: string): Promise<ApiResponse> => {
    const response = await api.post(`/transactions/${id}/reject`);
    return response.data as ApiResponse;
  }
};

// Anamath Entries API
export const anamathApi = {
  create: async (data: CreateAnamathEntryData): Promise<ApiResponse<AnamathEntry>> => {
    const response = await api.post('/anamath-entries', data);
    return response.data as ApiResponse<AnamathEntry>;
  },

  getNextNumber: async (): Promise<ApiResponse<{ nextTransactionNumber: number }>> => {
    const response = await api.get('/anamath-entries/next-number');
    return response.data as ApiResponse<{ nextTransactionNumber: number }>;
  },

  getAll: async (params?: PaginationParams & {
    startDate?: string;
    endDate?: string;
    ledgerId?: string;
  }): Promise<PaginatedResponse<AnamathEntry>> => {
    const response = await api.get('/anamath-entries', { params });
    return response.data as PaginatedResponse<AnamathEntry>;
  },

  getById: async (id: string): Promise<ApiResponse<AnamathEntry>> => {
    try {
      // Ensure a valid UUID is being sent
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        console.error(`[Anamath API] Invalid UUID format: ${id}`);
        return {
          success: false,
          message: 'Invalid record ID format'
        };
      }

      const response = await api.get(`/anamath-entries/${id}`, {
        params: { _: new Date().getTime() }, // Add unique timestamp to prevent caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        skipAuthRedirect: true // Don't auto-redirect on 401 - let EditAnamath handle it
      });


      if (!response.data) {
        console.error(`[Anamath API] Empty response for ID ${id}`);
        return {
          success: false,
          message: 'Empty response from server'
        };
      }

      // If the response is not a success, return it as is
      if (!response.data.success) {
        return response.data as ApiResponse<AnamathEntry>;
      }

      // Process and normalize the response structure
      const apiResponse = response.data;

      // Ensure the data field exists and contains the entry
      if (!apiResponse.data) {
        console.error(`[Anamath API] Missing data field in response for ID ${id}`);
        return {
          success: false,
          message: 'Invalid data structure in server response'
        };
      }

      return apiResponse as ApiResponse<AnamathEntry>;
    } catch (error) {
      console.error(`[Anamath API] Error fetching entry ${id}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch record'
      };
    }
  },

  update: async (id: string, data: Partial<CreateAnamathEntryData>): Promise<ApiResponse<AnamathEntry>> => {
    try {
      // Validate input
      if (!id) {
        return { success: false, message: 'Missing record ID' };
      }

      // Ensure data has required fields
      if (!data.date || !data.amount || data.amount <= 0) {
        return {
          success: false,
          message: 'Invalid data. Date and amount > 0 are required.'
        };
      }

      const response = await api.put(`/anamath-entries/${id}`, data, {
        skipAuthRedirect: true // Don't auto-redirect on 401 - let EditAnamath handle it
      });

      return response.data as ApiResponse<AnamathEntry>;
    } catch (error) {
      console.error(`[Anamath API] Error updating entry ${id}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update record'
      };
    }
  },

  delete: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/anamath-entries/${id}`);
    return response.data as ApiResponse;
  },

  close: async (id: string): Promise<ApiResponse<AnamathEntry>> => {
    const response = await api.put(`/anamath-entries/${id}/close`);
    return response.data as ApiResponse<AnamathEntry>;
  },

  reopen: async (id: string): Promise<ApiResponse<AnamathEntry>> => {
    const response = await api.put(`/anamath-entries/${id}/reopen`);
    return response.data as ApiResponse<AnamathEntry>;
  },

  getClosed: async (params?: PaginationParams & {
    startDate?: string;
    endDate?: string;
    ledgerId?: string;
  }): Promise<PaginatedResponse<AnamathEntry>> => {
    const response = await api.get('/anamath-entries/closed/list', { params });
    return response.data as PaginatedResponse<AnamathEntry>;
  },

  getStats: async (params?: {
    startDate?: string;
    endDate?: string;
    ledgerId?: string;
  }): Promise<ApiResponse<{
    totalAmount: number;
    totalEntries: number;
    averageAmount: number;
    maxAmount: number;
    minAmount: number;
    dateRange: { start: string; end: string };
  }>> => {
    const response = await api.get('/anamath-entries/stats/summary', { params });
    return response.data as ApiResponse<{
      totalAmount: number;
      totalEntries: number;
      averageAmount: number;
      maxAmount: number;
      minAmount: number;
      dateRange: { start: string; end: string };
    }>;
  },

  approve: async (id: string): Promise<ApiResponse> => {
    const response = await api.post(`/anamath-entries/${id}/approve`);
    return response.data as ApiResponse;
  },

  reject: async (id: string): Promise<ApiResponse> => {
    const response = await api.post(`/anamath-entries/${id}/reject`);
    return response.data as ApiResponse;
  }
};

// System Settings API
export const systemSettingsApi = {
  get: async (key: string): Promise<ApiResponse<SystemSetting>> => {
    const response = await api.get(`/system-settings/${key}`);
    return response.data as ApiResponse<SystemSetting>;
  },

  set: async (key: string, data: {
    value: any;
    dataType?: 'string' | 'number' | 'boolean' | 'json';
    description?: string;
  }): Promise<ApiResponse<SystemSetting>> => {
    const response = await api.put(`/system-settings/${key}`, data);
    return response.data as ApiResponse<SystemSetting>;
  },

  getAll: async (): Promise<ApiResponse<{ settings: SystemSetting[] }>> => {
    const response = await api.get('/system-settings');
    return response.data as ApiResponse<{ settings: SystemSetting[] }>;
  }
};

// Opening Balance API
export interface OpeningBalance {
  id: string;
  date: string;
  ledgerId: string;
  openingAmount: number;
  closingAmount: number;
  totalCredits: number;
  totalDebits: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  ledger?: Ledger;
}

export interface OpeningBalanceSummary {
  totalOpeningBalance: number;
  totalClosingBalance: number;
  totalCredits: number;
  totalDebits: number;
  netChange: number;
  ledgerCount: number;
  date: string;
}

export const openingBalanceApi = {
  getCurrent: async (): Promise<ApiResponse<OpeningBalance[]>> => {
    const response = await api.get('/opening-balances/current');
    return response.data as ApiResponse<OpeningBalance[]>;
  },

  getSummary: async (): Promise<ApiResponse<OpeningBalanceSummary>> => {
    const response = await api.get('/opening-balances/summary');
    return response.data as ApiResponse<OpeningBalanceSummary>;
  },

  getHistory: async (ledgerId: string, days: number = 7): Promise<ApiResponse<OpeningBalance[]>> => {
    const response = await api.get(`/opening-balances/history/${ledgerId}`, {
      params: { days }
    });
    return response.data as ApiResponse<OpeningBalance[]>;
  },

  calculate: async (ledgerId: string, date: string): Promise<ApiResponse<OpeningBalance>> => {
    const response = await api.post('/opening-balances/calculate', {
      ledgerId,
      date
    });
    return response.data as ApiResponse<OpeningBalance>;
  },

  setManual: async (ledgerId: string, date: string, amount: number): Promise<ApiResponse<OpeningBalance>> => {
    const response = await api.put('/opening-balances/manual', {
      ledgerId,
      date,
      amount
    });
    return response.data as ApiResponse<OpeningBalance>;
  }
};

export default api;