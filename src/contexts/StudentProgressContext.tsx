'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { evaluateAchievements, calculateAchievementPoints } from '@/lib/achievementSystem'
import { useAchievementNotifications } from '@/components/achievements/AchievementNotification'
import { LeaderboardService } from '@/lib/leaderboardService'
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth'
import { AdvancedScoringSystem, QuestionMetrics, ScoreCalculation } from '@/lib/scoringSystem'
import { modules } from '@/data/modules'
import unifiedScoringService from '@/services/unifiedScoringService'
import rankingService from '@/services/rankingService'

export interface GameScore {
  gameId: string | number // Suporte para IDs string e legacy number
  score: number
  maxScore: number
  timeElapsed: number
  completedAt: Date
  exercisesCompleted: number
  totalExercises: number
  difficulty: string
  normalizedScore: number // 0-100 based on completion rate
  isPersonalBest: boolean
  previousBestScore?: number
  attempt: number
  isCollaborative?: boolean
  partnerId?: string
  partnerName?: string
  scoreCalculation?: ScoreCalculation // Advanced scoring details
  questionMetrics?: QuestionMetrics[] // Per-question metrics
  moduleId?: string // ID do módulo real
  moduleName?: string // Nome do módulo real
}

export interface StudentProgress {
  studentId: string
  studentName: string
  totalScore: number
  totalPossibleScore: number
  gamesCompleted: number
  totalGames: number
  averageScore: number
  totalTimeSpent: number
  gameScores: GameScore[]
  achievements: string[]
  lastActivity: Date
  rankingScore: number // Total normalized score (0-200 for 2 games)
  currentRank: number
  improvementStreak: number
}


interface StudentProgressContextType {
  progress: StudentProgress
  updateGameScore: (gameScore: Omit<GameScore, 'normalizedScore' | 'isPersonalBest' | 'attempt'>) => void
  updateModuleScore: (moduleId: string, score: number, maxScore: number, timeElapsed: number, exercisesCompleted: number, totalExercises: number, difficulty: string) => Promise<void>
  updateExerciseScore: (moduleId: string, exerciseId: string, score: number, maxScore: number) => Promise<void>
  updateGameScoreAdvanced: (
    gameScore: Omit<GameScore, 'normalizedScore' | 'isPersonalBest' | 'attempt' | 'scoreCalculation'>,
    questionMetrics: QuestionMetrics[]
  ) => void
  resetProgress: () => void
  getGameProgress: (gameId: number) => GameScore | null
  newAchievements: string[]
  clearNewAchievements: () => void
  calculateOverallPerformance: () => {
    performance: 'Excelente' | 'Bom' | 'Regular' | 'Precisa Melhorar' | 'Em Progresso'
    color: string
    recommendation: string
  }
  calculateNormalizedScore: (exercisesCompleted: number, totalExercises: number) => number
}

const StudentProgressContext = createContext<StudentProgressContextType | undefined>(undefined)

const generateStudentName = () => {
  // Return generic name instead of fake names
  return 'Estudante'
}

// Função para mapear módulos reais para dados demo baseados em dados reais
const getModuleGameScores = (): GameScore[] => {
  return modules.slice(0, 2).map((module, index) => {
    const totalPoints = module.exercises.reduce((sum, exercise) => sum + exercise.points, 0)
    const completedExercises = module.exercises.length
    
    // Pontuações demo baseadas na pontuação real dos módulos (70-80% da pontuação máxima)
    const demoScorePercentages = [0.75, 0.85] // 75% e 85% da pontuação máxima
    const demoScore = Math.floor(totalPoints * demoScorePercentages[index])
    
    return {
      gameId: index + 1,
      score: demoScore,
      maxScore: totalPoints, // Usar pontuação real do módulo
      timeElapsed: index === 0 ? 900 : 720,
      completedAt: new Date(`2024-01-0${index + 1}`),
      exercisesCompleted: completedExercises,
      totalExercises: completedExercises,
      difficulty: 'intermediate',
      normalizedScore: Math.floor(demoScorePercentages[index] * 100), // Porcentagem real
      isPersonalBest: true,
      attempt: 1,
      moduleId: module.id,
      moduleName: module.title
    }
  })
}

const getInitialProgress = (): StudentProgress => {
  // Check if in guest mode
  const isGuestMode = typeof window !== 'undefined' &&
    document.cookie.split(';').some(cookie => cookie.trim().startsWith('guest-mode=true'))

  // For guest mode, show demo data with 2 completed games
  if (isGuestMode) {
    const gameScores = getModuleGameScores()

    const totalScore = gameScores.reduce((sum, score) => sum + score.score, 0)
    const totalPossibleScore = gameScores.reduce((sum, score) => sum + score.maxScore, 0)
    const averageScore = (totalScore / totalPossibleScore) * 100

    return {
      studentId: 'guest-user',
      studentName: 'Usuário Visitante',
      totalScore,
      totalPossibleScore,
      gamesCompleted: gameScores.length,
      totalGames: 1,
      averageScore,
      totalTimeSpent: gameScores.reduce((sum, score) => sum + score.timeElapsed, 0),
      gameScores,
      achievements: ['first-game', 'quick-learner'],
      lastActivity: new Date('2024-01-02'),
      rankingScore: gameScores.reduce((sum, score) => sum + score.normalizedScore, 0),
      currentRank: 3,
      improvementStreak: 2
    }
  }

  // For regular users, start with empty progress
  return {
    studentId: 'student-default',
    studentName: 'Estudante',
    totalScore: 0,
    totalPossibleScore: 0,
    gamesCompleted: 0,
    totalGames: 4,
    averageScore: 0,
    totalTimeSpent: 0,
    gameScores: [],
    achievements: [],
    lastActivity: new Date(),
    rankingScore: 0,
    currentRank: 0,
    improvementStreak: 0
  }
}

export function StudentProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<StudentProgress>(() => {
    // Initialize with safe defaults for SSR
    return {
      studentId: 'student-default',
      studentName: 'Estudante',
      totalScore: 0,
      totalPossibleScore: 0,
      gamesCompleted: 0,
      totalGames: 1,
      averageScore: 0,
      totalTimeSpent: 0,
      gameScores: [],
      achievements: [],
      lastActivity: new Date('2024-01-01'),
      rankingScore: 0,
      currentRank: 0,
      improvementStreak: 0
    }
  })
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const { user } = useFirebaseAuth()
  const leaderboardService = new LeaderboardService()

  // Load progress from localStorage on mount (skip for guest mode)
  useEffect(() => {
    const isGuestMode = document.cookie.split(';').some(cookie => cookie.trim().startsWith('guest-mode=true'))

    if (isGuestMode) {
      // Set guest mode progress
      setProgress(getInitialProgress())
    } else {
      // Load from localStorage for regular users
      const savedProgress = localStorage.getItem('nt600-student-progress')
      if (savedProgress) {
        try {
          const parsed = JSON.parse(savedProgress)
          // Convert date strings back to Date objects
          parsed.lastActivity = new Date(parsed.lastActivity)
          parsed.gameScores = parsed.gameScores.map((score: any) => ({
            ...score,
            completedAt: new Date(score.completedAt)
          }))
          setProgress(parsed)
        } catch (error) {
          console.error('Error loading student progress:', error)
        }
      } else {
        // If no saved progress, start with empty progress
        // Progress will be built as user completes games
        setProgress(getInitialProgress())

        // For demonstration purposes, let's simulate a user who completed 1 game
        // This can be removed once real game completion is implemented
        setTimeout(() => {
          const demoGameScore = {
            gameId: 1,
            score: 85,
            maxScore: 100,
            timeElapsed: 900,
            completedAt: new Date(),
            exercisesCompleted: 5,
            totalExercises: 5,
            difficulty: 'intermediate' as const
          }
          updateGameScore(demoGameScore)
        }, 100)
      }
    }

    setIsInitialized(true)
  }, [])

  // Save progress to localStorage whenever it changes (skip for guest mode)
  useEffect(() => {
    if (!isInitialized) return // Don't save until initialized

    const isGuestMode = document.cookie.split(';').some(cookie => cookie.trim().startsWith('guest-mode=true'))
    if (isGuestMode) return // Don't save progress for guests

    localStorage.setItem('nt600-student-progress', JSON.stringify(progress))
  }, [progress, isInitialized])

  const calculateNormalizedScore = (exercisesCompleted: number, totalExercises: number): number => {
    return Math.round((exercisesCompleted / totalExercises) * 100)
  }

  // Nova função para atualizar exercício individual
  const updateExerciseScore = async (moduleId: string, exerciseId: string, score: number, maxScore: number) => {
    if (user && user.id) {
      try {
        console.log(`Salvando exercício ${exerciseId} do módulo ${moduleId}:`, { score, maxScore });
        
        // Salvar exercício individual no unified scoring service
        await unifiedScoringService.updateExerciseScore(
          user.id,
          moduleId,
          exerciseId,
          score,
          maxScore
        );

        // Recalcular e atualizar ranking em tempo real
        await rankingService.updateStudentRanking(user.id);
        
        console.log(`Exercício ${exerciseId} salvo e ranking atualizado!`);
        
        // Trigger re-render ou notificação aqui se necessário
        // Para notificar outros componentes sobre a mudança
        window.dispatchEvent(new CustomEvent('exerciseCompleted', { 
          detail: { moduleId, exerciseId, score, maxScore }
        }));
        
      } catch (error) {
        console.error('Erro ao salvar exercício:', error);
      }
    }
  }

  // Nova função para atualizar com dados de módulos reais
  const updateModuleScore = async (moduleId: string, score: number, maxScore: number, timeElapsed: number, exercisesCompleted: number, totalExercises: number, difficulty: string) => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return

    const gameScore = {
      gameId: moduleId,
      score,
      maxScore,
      timeElapsed,
      completedAt: new Date(),
      exercisesCompleted,
      totalExercises,
      difficulty,
      moduleId: module.id,
      moduleName: module.title
    }

    // Atualizar progresso local
    updateGameScore(gameScore)

    // Atualizar sistema de pontuação unificado
    if (user && user.id) {
      try {
        // Calcular pontuação ponderada do módulo (0-100)
        const normalizedScore = rankingService.calculateModuleScore(moduleId, { [moduleId]: (score / maxScore) * 100 });
        
        // Atualizar no serviço unificado
        await unifiedScoringService.updateModuleScore(
          user.id,
          moduleId,
          normalizedScore,
          {
            timeSpent: timeElapsed,
            attempts: 1 // Por enquanto, será expandido futuramente
          }
        );

        console.log(`Pontuação do módulo ${moduleId} atualizada:`, normalizedScore);
      } catch (error) {
        console.error('Erro ao atualizar pontuação unificada:', error);
      }
    }
  }

  const updateGameScore = (gameScore: Omit<GameScore, 'normalizedScore' | 'isPersonalBest' | 'attempt'>) => {
    setProgress(prev => {
      const existingScoreIndex = prev.gameScores.findIndex(score => score.gameId === gameScore.gameId)
      const normalizedScore = calculateNormalizedScore(gameScore.exercisesCompleted, gameScore.totalExercises)

      let isPersonalBest = true
      let previousBestScore: number | undefined
      let attempt = 1

      if (existingScoreIndex >= 0) {
        const existingScore = prev.gameScores[existingScoreIndex]
        previousBestScore = existingScore.normalizedScore
        isPersonalBest = normalizedScore > existingScore.normalizedScore
        attempt = existingScore.attempt + 1
      }

      const enhancedGameScore: GameScore = {
        ...gameScore,
        normalizedScore,
        isPersonalBest,
        previousBestScore,
        attempt
      }

      let newGameScores: GameScore[]

      if (existingScoreIndex >= 0) {
        // Only update if it's a better score
        if (isPersonalBest) {
          newGameScores = [...prev.gameScores]
          newGameScores[existingScoreIndex] = enhancedGameScore
        } else {
          // Keep the existing better score but update attempt count
          newGameScores = [...prev.gameScores]
          newGameScores[existingScoreIndex] = {
            ...newGameScores[existingScoreIndex],
            attempt: attempt
          }
          return prev // Don't update if score didn't improve
        }
      } else {
        // Add new score
        newGameScores = [...prev.gameScores, enhancedGameScore]
      }

      // Calculate new totals
      const totalScore = newGameScores.reduce((sum, score) => sum + score.score, 0)
      const totalPossibleScore = newGameScores.reduce((sum, score) => sum + score.maxScore, 0)
      const totalTimeSpent = newGameScores.reduce((sum, score) => sum + score.timeElapsed, 0)
      const gamesCompleted = newGameScores.length
      const averageScore = gamesCompleted > 0 ? (totalScore / totalPossibleScore) * 100 : 0

      // Calculate ranking score (sum of normalized scores)
      const rankingScore = newGameScores.reduce((sum, score) => sum + score.normalizedScore, 0)

      // Calculate improvement streak
      let improvementStreak = prev.improvementStreak
      if (isPersonalBest) {
        improvementStreak += 1
      } else if (existingScoreIndex >= 0) {
        improvementStreak = 0 // Reset streak if no improvement
      }

      // Evaluate achievements using the comprehensive system
      const currentProgress = {
        totalScore,
        averageScore,
        gamesCompleted: prev.gamesCompleted,
        gameScores: prev.gameScores.map(score => ({
          gameId: score.gameId,
          score: score.score,
          maxScore: score.maxScore,
          timeElapsed: score.timeElapsed,
          isCollaborative: score.isCollaborative,
          partnerId: score.partnerId
        })),
        achievements: prev.achievements,
        improvementStreak
      }

      const earnedAchievements = evaluateAchievements(currentProgress, {
        gameId: gameScore.gameId,
        score: gameScore.score,
        maxScore: gameScore.maxScore,
        timeElapsed: gameScore.timeElapsed,
        isCollaborative: gameScore.isCollaborative,
        partnerId: gameScore.partnerId
      })

      const updatedAchievements = [...prev.achievements, ...earnedAchievements]

      // Set new achievements for notifications
      if (earnedAchievements.length > 0) {
        setNewAchievements(earnedAchievements)
      }

      const updatedProgress = {
        ...prev,
        totalScore,
        totalPossibleScore,
        gamesCompleted,
        averageScore,
        totalTimeSpent,
        gameScores: newGameScores,
        achievements: updatedAchievements,
        lastActivity: new Date(),
        rankingScore,
        improvementStreak
      }

      // Save to Firebase leaderboard if user is authenticated
      if (user && user.uid && user.uid !== 'guest-user' && user.uid !== 'professor-guest-user') {
        const anonymousId = user.anonymousId || `#${Math.floor(Math.random() * 9000) + 1000}`
        leaderboardService.updateUserScore(
          user.uid,
          anonymousId,
          rankingScore,
          gamesCompleted,
          averageScore
        ).catch(error => {
          console.error('Failed to update leaderboard:', error)
        })
      }

      return updatedProgress
    })
  }

  const resetProgress = () => {
    setProgress(initialProgress)
    localStorage.removeItem('nt600-student-progress')
  }

  const getGameProgress = (gameId: number): GameScore | null => {
    return progress.gameScores.find(score => score.gameId === gameId) || null
  }

  const calculateOverallPerformance = () => {
    const { averageScore, gamesCompleted, totalScore } = progress

    if (gamesCompleted === 0) {
      return {
        performance: 'Em Progresso' as const,
        color: 'blue',
        recommendation: 'Comece jogando para avaliar seu progresso!'
      }
    }

    // For students who have completed few games but have good scores, show "Em Progresso"
    if (gamesCompleted === 1 && totalScore >= 70) {
      return {
        performance: 'Em Progresso' as const,
        color: 'blue',
        recommendation: 'Bom início! Continue jogando para melhorar sua classificação.'
      }
    }

    if (averageScore >= 85) {
      return {
        performance: 'Excelente' as const,
        color: 'green',
        recommendation: 'Parabéns! Você domina os conceitos de avaliação nutricional.'
      }
    } else if (averageScore >= 70) {
      return {
        performance: 'Bom' as const,
        color: 'blue',
        recommendation: 'Bom desempenho! Continue praticando para aperfeiçoar.'
      }
    } else if (averageScore >= 50) {
      return {
        performance: 'Regular' as const,
        color: 'yellow',
        recommendation: 'Revise o conteúdo teórico e pratique mais os exercícios.'
      }
    } else {
      // Only show "Precisa Melhorar" for students with consistently low scores
      return {
        performance: 'Precisa Melhorar' as const,
        color: 'red',
        recommendation: 'Recomendamos revisar o material da disciplina antes de continuar.'
      }
    }
  }


  const clearNewAchievements = () => {
    setNewAchievements([])
  }

  // Advanced scoring method with question metrics
  const updateGameScoreAdvanced = (
    gameScore: Omit<GameScore, 'normalizedScore' | 'isPersonalBest' | 'attempt' | 'scoreCalculation'>,
    questionMetrics: QuestionMetrics[]
  ) => {
    // Calculate advanced score
    const scoreCalculation = AdvancedScoringSystem.calculateScore(
      questionMetrics,
      gameScore.timeElapsed,
      gameScore.isCollaborative
    )
    
    // Use the normalized score from the advanced calculation
    const normalizedScore = AdvancedScoringSystem.calculateNormalizedScore(scoreCalculation)
    
    // Create enhanced game score with advanced scoring
    const enhancedGameScore = {
      ...gameScore,
      score: scoreCalculation.finalScore,
      normalizedScore,
      scoreCalculation,
      questionMetrics
    }
    
    // Update using the existing method
    updateGameScore(enhancedGameScore)
  }

  return (
    <StudentProgressContext.Provider value={{
      progress,
      updateGameScore,
      updateModuleScore,
      updateExerciseScore,
      updateGameScoreAdvanced,
      resetProgress,
      getGameProgress,
      calculateOverallPerformance,
      calculateNormalizedScore,
      newAchievements,
      clearNewAchievements
    }}>
      {children}
    </StudentProgressContext.Provider>
  )
}

export function useStudentProgress() {
  const context = useContext(StudentProgressContext)
  if (context === undefined) {
    throw new Error('useStudentProgress must be used within a StudentProgressProvider')
  }
  return context
}

// Achievement definitions
export const achievements = {
  'first-game': {
    title: 'Primeiro Passo',
    description: 'Completou seu primeiro jogo de avaliação nutricional',
    icon: '🎯',
    color: 'blue'
  },
  'all-games': {
    title: 'Explorador Completo',
    description: 'Completou todos os jogos de avaliação nutricional',
    icon: '🏆',
    color: 'gold'
  },
  'perfect-score': {
    title: 'Pontuação Perfeita',
    description: 'Obteve pontuação máxima em um jogo',
    icon: '⭐',
    color: 'yellow'
  },
  'high-performer': {
    title: 'Alto Desempenho',
    description: 'Mantém média acima de 85% nos jogos',
    icon: '🚀',
    color: 'green'
  }
}

// Utility function to format time
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}
