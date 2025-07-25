import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore, enableNetwork, disableNetwork, connectFirestoreEmulator } from 'firebase/firestore'

// Cache de configuração Firebase para evitar logs repetidos
let firebaseConfigCache: { configured: boolean; logged: boolean } = {
  configured: false,
  logged: false
}

// Helper function to check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  // Se já foi verificado e logado, retornar resultado do cache
  if (firebaseConfigCache.logged) {
    return firebaseConfigCache.configured
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  // Extract project ID from auth domain if not explicitly set
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (authDomain ? authDomain.split('.')[0] : null)
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  // Check if all required variables exist
  const isConfigured = !!(apiKey && authDomain && projectId && appId)

  // Log apenas uma vez na inicialização
  if (!firebaseConfigCache.logged) {
    console.log('🔥 Firebase Configuration Status:', {
      configured: isConfigured,
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
      authDomain: authDomain || 'MISSING',
      projectId: projectId || 'MISSING',
      appId: appId ? `${appId.substring(0, 20)}...` : 'MISSING'
    })
    
    // Marcar como logado e salvar no cache
    firebaseConfigCache = {
      configured: isConfigured,
      logged: true
    }
  }

  return isConfigured
}

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // Extract project ID from auth domain if not explicitly set
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.split('.')[0] :
      'vireiestatistica-ba7c5'),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase only if credentials are properly configured
let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

// Singleton pattern to prevent multiple initializations
let isInitialized = false

const initializeFirebase = () => {
  if (isInitialized) {
    return { app, auth, db }
  }

  try {
    if (isFirebaseConfigured()) {
      console.log('🔥 Initializing Firebase with configured credentials...')

      // Check for demo-project issue
      if (firebaseConfig.projectId === 'demo-project') {
        console.error('❌ CRITICAL: Firebase is trying to connect to demo-project!')
        console.error('🔧 This means environment variables are not being loaded correctly')
        console.error('📝 Check Vercel environment variables or .env.local configuration')
        throw new Error('Invalid Firebase project configuration')
      }

      app = initializeApp(firebaseConfig)
      auth = getAuth(app)
      db = getFirestore(app)

      // Enable offline persistence for better offline experience
      if (typeof window !== 'undefined') {
        // Only enable in browser environment
        console.log('🔄 Enabling Firestore offline persistence...')
      }

      isInitialized = true
      console.log('✅ Firebase initialized successfully!')
      console.log(`🎯 Connected to project: ${firebaseConfig.projectId}`)
    } else {
      console.warn('⚠️ Firebase not configured - using fallback mode')
      console.warn('📝 To use Firebase, configure NEXT_PUBLIC_FIREBASE_* variables in .env.local')
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error)
    console.warn('🔄 Using fallback mode')
  }

  return { app, auth, db }
}

// Initialize Firebase
const { app: firebaseApp, auth: firebaseAuth, db: firebaseDb } = initializeFirebase()
app = firebaseApp
auth = firebaseAuth
db = firebaseDb

// Helper function to handle Firestore errors
export const handleFirestoreError = (error: any): string => {
  console.error('Firestore error:', error)

  if (error.code === 'unavailable') {
    return 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.'
  }

  if (error.code === 'permission-denied') {
    return 'Acesso negado. Verifique suas permissões.'
  }

  if (error.code === 'not-found') {
    return 'Dados não encontrados.'
  }

  if (error.message && error.message.includes('offline')) {
    return 'Você está offline. Verifique sua conexão com a internet.'
  }

  if (error.message && error.message.includes('network')) {
    return 'Erro de rede. Verifique sua conexão com a internet.'
  }

  return 'Erro inesperado. Tente novamente.'
}

// Helper function to retry Firestore operations
export const retryFirestoreOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      console.warn(`Firestore operation failed (attempt ${attempt}/${maxRetries}):`, error)

      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }

  throw new Error('Max retries exceeded')
}

export { auth, db }

// Connect to emulators in development (optional)
// Uncomment and configure if you want to use Firebase emulators
// if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
//   try {
//     connectAuthEmulator(auth, 'http://localhost:9099')
//     connectFirestoreEmulator(db, 'localhost', 8080)
//   } catch (error) {
//     console.log('Firebase emulators not connected:', error)
//   }
// }

// Firebase data type definitions
export interface User {
  id: string
  email: string
  fullName: string
  role: 'professor' | 'student'
  roleHistory?: ('professor' | 'student')[] // Track role changes
  anonymousId?: string // For students only
  institutionId: string
  totalScore: number
  levelReached: number
  gamesCompleted: number
  collaborationHistory: CollaborationRecord[]
  preferredPartners: string[] // Student IDs
  achievements: string[]
  createdAt: string
  updatedAt: string
  authProvider?: 'email' | 'google' // Track authentication method
}

export interface CollaborationRecord {
  sessionId: string
  partnerId: string
  partnerName: string
  caseStudyId: string
  score: number
  completedAt: string
  collaborationRating: number
}

export interface Course {
  id: string
  code: string // "NT600"
  title: string
  description: string
  professorId: string
  studentIds: string[]
  moduleSettings: ModuleSettings[]
  createdAt: string
  updatedAt: string
}

export interface ModuleSettings {
  moduleId: number
  isLocked: boolean
  unlockedAt?: string
  prerequisites: number[]
}

export interface GameProgress {
  id: string
  userId: string
  gameId: number
  level: number
  score: number
  maxScore: number
  normalizedScore: number
  completed: boolean
  attempts: number
  bestTime?: number
  lastAttemptAt: string
  completedAt?: string
  difficulty: string
  isPersonalBest: boolean
  isCollaborative?: boolean
  partnerId?: string
  partnerName?: string
  collaborationNotes?: string[]
  createdAt: string
}

export interface Achievement {
  id: string
  userId: string
  achievementType: 'milestone' | 'performance' | 'engagement' | 'mastery' | 'collaboration'
  title: string
  description: string
  icon: string
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  criteria: AchievementCriteria
  earnedAt: string
}

export interface AchievementCriteria {
  trigger: 'score_threshold' | 'completion_time' | 'streak' | 'perfect_score' | 'collaboration'
  value: number
  gameId?: number
  moduleId?: number
}

export interface CollaborativeSession {
  id: string
  primaryStudentId: string
  partnerStudentId: string
  caseStudyId: string
  startedAt: string
  completedAt?: string
  sharedScore: number
  collaborationNotes: string[]
  discussionPrompts: DiscussionPrompt[]
  status: 'active' | 'completed' | 'abandoned'
}

export interface DiscussionPrompt {
  id: string
  text: string
  phase: 'analysis' | 'hypothesis' | 'decision' | 'reflection'
  completed: boolean
}

export interface LeaderboardEntry {
  userId: string
  anonymousId: string
  totalScore: number
  gamesCompleted: number
  averageScore: number
  lastUpdated: string
  rank: number
}

export interface Game {
  id: number
  title: string
  description: string
  category: 'descriptive' | 'inferential' | 'epidemiological' | 'visualization'
  difficultyLevel: number
  learningObjectives: string[]
  maxScore: number
  timeLimit?: number
  instructions: string
  createdAt: string
  updatedAt: string
}

export interface Dataset {
  id: string
  name: string
  description: string
  source: string
  data: Record<string, unknown>
  category: 'descriptive' | 'inferential' | 'epidemiological' | 'visualization'
  difficultyLevel: number
  variables: string[]
  sampleSize: number
  createdAt: string
}

export interface GameSession {
  id: string
  userId: string
  gameId: number
  startTime: string
  endTime?: string
  score: number
  completed: boolean
  sessionData: Record<string, unknown>
  answers: Record<string, unknown>
  feedback: Record<string, unknown>
}

// RBAC Permissions Matrix
export const RBAC_PERMISSIONS = {
  professor: {
    modules: ['create', 'read', 'update', 'delete', 'unlock', 'lock'],
    students: ['read', 'monitor', 'message'],
    collaboration: ['view_all_sessions', 'moderate', 'assign_partners'],
    analytics: ['view_class', 'export_data', 'generate_reports'],
    content: ['create_cases', 'edit_cases', 'manage_questions']
  },
  student: {
    modules: ['read_unlocked'],
    collaboration: ['create_session', 'join_session', 'invite_partner'],
    progress: ['read_own', 'update_own'],
    achievements: ['view_own', 'share_public']
  }
} as const

// Utility functions
export const generateAnonymousId = (): string => {
  // Generate exactly 4 digits (1000-9999)
  const fourDigitNumber = Math.floor(Math.random() * 9000) + 1000
  return `${fourDigitNumber}`
}

// Extract first name from email for personalized greetings
export const extractFirstNameFromEmail = (email: string): string => {
  try {
    // Extract the part before @ and before any dots
    const localPart = email.split('@')[0]

    // Handle common patterns like "nome.sobrenome" or "nome_sobrenome"
    const firstName = localPart.split(/[._-]/)[0]

    // Capitalize first letter
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  } catch {
    return 'Usuário'
  }
}

// Get personalized greeting based on time of day
export const getPersonalizedGreeting = (name: string): string => {
  const hour = new Date().getHours()

  if (hour < 12) {
    return `Bom dia, ${name}!`
  } else if (hour < 18) {
    return `Boa tarde, ${name}!`
  } else {
    return `Boa noite, ${name}!`
  }
}

export const hasPermission = (
  userRole: 'professor' | 'student',
  resource: keyof typeof RBAC_PERMISSIONS.professor,
  action: string
): boolean => {
  const permissions = RBAC_PERMISSIONS[userRole]
  return permissions[resource]?.includes(action) || false
}

// Inicializar monitoramento de conexão se Firebase está configurado
if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  console.log('🔌 [Firebase] Inicializando monitoramento de conexão...');
  
  // Importar e inicializar o monitoramento de forma assíncrona
  // para evitar problemas de dependência circular
  import('@/services/connectionMonitorService')
    .then(({ connectionMonitor }) => {
      console.log('✅ [Firebase] Monitoramento de conexão inicializado');
    })
    .catch((error) => {
      console.warn('⚠️ [Firebase] Falha ao inicializar monitoramento:', error);
    });
}

export default app
