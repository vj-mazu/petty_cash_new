import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, authApi } from '../services/api';
import { toast } from 'react-toastify';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' };

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true to check existing auth
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Check for existing token on mount
    const initializeAuth = async () => {
      const token = sessionStorage.getItem('token');
      const userData = sessionStorage.getItem('user');

      if (token && userData) {
        try {
          const user = JSON.parse(userData);

          // Set loading state while verifying token
          dispatch({ type: 'SET_LOADING', payload: true });

          // Verify token is still valid by fetching profile
          try {
            const response = await authApi.getProfile();
            if (response.success && response.data?.user) {
              dispatch({
                type: 'LOGIN_SUCCESS',
                payload: { user: response.data.user, token }
              });
            } else {
              // Token is invalid, logout
              logout();
            }
          } catch (error) {
            // Token is invalid, logout
            logout();
          }
        } catch (error) {
          // Invalid stored data, logout
          logout();
        }
      } else {
        // No token found, set loading to false
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });

      const response = await authApi.login({ username, password });

      if (response.success) {
        const { user, token } = response.data;

        // Store in sessionStorage (cleared on browser close)
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });

        toast.success('Login successful!');
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Login failed';

      // Specifically handle axios timeout errors
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        errorMessage = 'The server is taking a bit longer to start up (cold start). Please wait a moment and try again.';
      } else if (error.message === 'Network Error') {
        errorMessage = 'Network Error. The server might be starting up or is unreachable.';
      }

      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      toast.error(errorMessage, { autoClose: 6000 });
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, role?: string): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });

      const response = await authApi.register({ username, email, password, role });

      if (response.success) {
        const { user, token } = response.data;

        // Store in sessionStorage (cleared on browser close)
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });

        toast.success('Registration successful!');
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = (): void => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
    toast.info('Logged out successfully');
  };

  const updateUser = (user: User): void => {
    sessionStorage.setItem('user', JSON.stringify(user));
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};