import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  Timestamp,
  onSnapshot,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  EnhancedClass, 
  EnhancedStudentOverview, 
  ClassAnalytics, 
  ClassRanking, 
  ClassFilter,
  ClassExportData,
  BulkAction,
  ClassAlert,
  StudentModuleProgress,
  StudentExerciseProgress,
  BasicStudent
} from '@/types/classes'
import { modules } from '@/lib/gameData'; // Importar módulos
import unifiedScoringService from './unifiedScoringService'
import { parseFirebaseDate } from '@/utils/dateUtils'

export class EnhancedClassService {
  
  // Obter informações detalhadas da turma
  static async getEnhancedClassInfo(classId: string): Promise<EnhancedClass | null> {
    try {
      const classDoc = await getDoc(doc(db, 'classes', classId))
      
      if (!classDoc.exists()) {
        return null
      }
      
      const data = classDoc.data()
      
      // Calcular estatísticas em tempo real
      const students = await this.getClassStudentsBasic(classId)
      const analytics = await this.calculateClassAnalytics(classId)
      
      return {
        id: classDoc.id,
        name: data.name,
        description: data.description,
        semester: data.semester,
        year: data.year,
        inviteCode: data.inviteCode,
        professorId: data.professorId,
        professorName: data.professorName,
        status: data.status || 'open',
        maxStudents: data.maxStudents,
        acceptingNewStudents: data.acceptingNewStudents ?? true,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        settings: data.settings || this.getDefaultClassSettings(),
        
        // Estatísticas calculadas
        studentsCount: students.length,
        activeStudents: students.filter(s => s.status === 'active' && 
          (Date.now() - this.getLastActivityTimestamp(s.lastActivity)) < 7 * 24 * 60 * 60 * 1000).length,
        totalModules: Array.isArray(modules) ? modules.length : 4,
        avgProgress: analytics?.averageProgress || 0,
        avgScore: analytics?.averageScore || 0,
        lastActivity: analytics?.date
      } as EnhancedClass
      
    } catch (error) {
      console.error('Erro ao buscar informações da turma:', error)
      return null
    }
  }
  
  // Obter alunos com informações detalhadas
  static async getEnhancedClassStudents(
    classId: string,
    filter?: ClassFilter
  ): Promise<EnhancedStudentOverview[]> {
    try {
      // Validar parâmetros
      if (!classId) {
        console.warn('ClassId não fornecido para getEnhancedClassStudents')
        return []
      }

      console.log(`[EnhancedClassService] 🔄 Buscando estudantes para turma: ${classId}`)

      // Método 1: Query otimizada usando range de document IDs
      let students = await this.getStudentsMethod1(classId)
      
      if (students.length > 0) {
        console.log(`[EnhancedClassService] ✅ Método 1 bem-sucedido: ${students.length} estudantes encontrados`)
      } else {
        console.log(`[EnhancedClassService] ⚠️ Método 1 falhou, tentando Método 2...`)
        
        // Método 2: Query por status com filtro posterior
        students = await this.getStudentsMethod2(classId)
        
        if (students.length > 0) {
          console.log(`[EnhancedClassService] ✅ Método 2 bem-sucedido: ${students.length} estudantes encontrados`)
        } else {
          console.log(`[EnhancedClassService] ⚠️ Método 2 falhou, tentando Método 3 (fallback completo)...`)
          
          // Método 3: Fallback - buscar todos os documentos da turma
          students = await this.getStudentsMethod3(classId)
          
          console.log(`[EnhancedClassService] ${students.length > 0 ? '✅' : '❌'} Método 3: ${students.length} estudantes encontrados`)
        }
      }

      // Aplicar filtros
      let filteredStudents = students || []

      if (filter && filteredStudents.length > 0) {
        filteredStudents = this.applyFilters(filteredStudents, filter)
      }

      // Calcular rankings
      if (filteredStudents.length > 0) {
        filteredStudents = this.calculateClassRankings(filteredStudents)
      }

      console.log(`[EnhancedClassService] 📊 Total final de estudantes: ${filteredStudents.length}`)
      return filteredStudents || []

    } catch (error) {
      console.error('[EnhancedClassService] ❌ Erro crítico ao buscar alunos da turma:', error)
      return []
    }
  }

  // Método 1: Query otimizada usando range de document IDs (mais eficiente)
  private static async getStudentsMethod1(classId: string): Promise<EnhancedStudentOverview[]> {
    try {
      console.log(`[Método 1] Buscando com range query para ${classId}`)
      
      // Query usando range para documentos que começam com classId_
      const studentsQuery = query(
        collection(db, 'classStudents'),
        where('__name__', '>=', `${classId}_`),
        where('__name__', '<', `${classId}_\uf8ff`)
      )

      const studentsSnapshot = await getDocs(studentsQuery)
      const students: EnhancedStudentOverview[] = []

      console.log(`[Método 1] ${studentsSnapshot.docs.length} documentos encontrados`)

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data()
        
        // Filtrar apenas documentos ativos (se o campo existir)
        if (studentData.status === 'removed' || studentData.status === 'inactive') {
          console.log(`[Método 1] Ignorando estudante inativo: ${doc.id}`)
          continue
        }

        const studentProgress = await this.getStudentDetailedProgress(
          studentData.studentId,
          classId
        )

        if (studentProgress) {
          students.push(studentProgress)
        }
      }

      return students

    } catch (error) {
      console.error('[Método 1] Erro:', error)
      return []
    }
  }

  // Método 2: Query por status ativo com filtro posterior (método original otimizado)
  private static async getStudentsMethod2(classId: string): Promise<EnhancedStudentOverview[]> {
    try {
      console.log(`[Método 2] Buscando por status ativo para ${classId}`)
      
      const studentsQuery = query(
        collection(db, 'classStudents'),
        where('status', '==', 'active')
      )

      const studentsSnapshot = await getDocs(studentsQuery)
      const students: EnhancedStudentOverview[] = []

      console.log(`[Método 2] ${studentsSnapshot.docs.length} documentos ativos encontrados`)

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data()
        const docId = doc.id

        // Verificar se o documento pertence à turma específica
        if (docId.startsWith(`${classId}_`)) {
          console.log(`[Método 2] ✅ Documento ${docId} pertence à turma`)
          
          const studentProgress = await this.getStudentDetailedProgress(
            studentData.studentId,
            classId
          )

          if (studentProgress) {
            students.push(studentProgress)
          }
        }
      }

      return students

    } catch (error) {
      console.error('[Método 2] Erro:', error)
      return []
    }
  }

  // Método 3: Fallback completo - buscar todos os documentos da turma independente do status
  private static async getStudentsMethod3(classId: string): Promise<EnhancedStudentOverview[]> {
    try {
      console.log(`[Método 3] Fallback completo para ${classId}`)
      
      // Buscar TODOS os documentos (sem filtro de status)
      const studentsQuery = query(collection(db, 'classStudents'))
      const studentsSnapshot = await getDocs(studentsQuery)
      const students: EnhancedStudentOverview[] = []

      console.log(`[Método 3] ${studentsSnapshot.docs.length} documentos totais encontrados`)

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data()
        const docId = doc.id

        // Verificar se o documento pertence à turma específica
        if (docId.startsWith(`${classId}_`)) {
          console.log(`[Método 3] ✅ Documento ${docId} pertence à turma (status: ${studentData.status || 'undefined'})`)
          
          // Aceitar qualquer status, exceto explicitamente removido
          if (studentData.status !== 'removed') {
            const studentProgress = await this.getStudentDetailedProgress(
              studentData.studentId,
              classId
            )

            if (studentProgress) {
              students.push(studentProgress)
            }
          }
        }
      }

      return students

    } catch (error) {
      console.error('[Método 3] Erro:', error)
      return []
    }
  }
  
  // Obter progresso detalhado de um estudante específico
  static async getStudentDetailedProgress(
    studentId: string,
    classId: string
  ): Promise<EnhancedStudentOverview | null> {
    try {
      // 1. Buscar dados do usuário (fonte principal de informações)
      const userDoc = await getDoc(doc(db, 'users', studentId))
      if (!userDoc.exists()) {
        console.warn(`[getStudentDetailedProgress] ❌ Usuário não encontrado: ${studentId}`)
        return null
      }
      const userData = userDoc.data()

      // 2. Buscar dados de matrícula na turma (confirma a associação)
      const enrollmentQuery = query(
        collection(db, 'classStudents'),
        where('classId', '==', classId),
        where('studentId', '==', studentId),
        limit(1)
      )
      const enrollmentSnapshot = await getDocs(enrollmentQuery)
      
      if (enrollmentSnapshot.empty) {
        console.warn(`[getStudentDetailedProgress] ❌ Matrícula não encontrada para estudante ${studentId} na turma ${classId}`)
        return null
      }
      const enrollmentData = enrollmentSnapshot.docs[0].data()

      // 3. Buscar progresso unificado (fonte de pontuação primária)
      console.log(`[getStudentDetailedProgress] 🔄 Buscando pontuação unificada para ${studentId}`)
      const unifiedScore = await unifiedScoringService.getUnifiedScore(studentId)
      if (unifiedScore) {
        console.log(`[getStudentDetailedProgress] ✅ Pontuação unificada encontrada.`)
      } else {
        console.log(`[getStudentDetailedProgress] ⚠️ Pontuação unificada não encontrada, continuará com cálculo legado.`)
      }
      
      // 4. Buscar progresso detalhado dos módulos (dados legados)
      const moduleProgress = await this.getLegacyModuleProgress(studentId)

      // 5. Consolidar e calcular métricas
      const { totalScore, completedModules, totalTimeSpent, overallProgress, moduleScores } = this.consolidateStudentMetrics(
        unifiedScore,
        moduleProgress
      )

      // 6. Calcular métricas de engajamento (simulado por enquanto)
      const engagementMetrics = await this.calculateStudentEngagement(studentId)

      // 7. Montar o objeto de retorno final
      const studentOverview: EnhancedStudentOverview = {
        studentId,
        studentName: userData.fullName || userData.name || enrollmentData.studentName || 'Nome não encontrado',
        email: userData.email || enrollmentData.email,
        avatarUrl: userData.avatarUrl,
        enrolledAt: parseFirebaseDate(enrollmentData.enrolledAt) || new Date(),
        lastActivity: parseFirebaseDate(userData.lastActivity) || new Date(),
        status: enrollmentData.status || 'active',
        role: 'student',

        overallProgress: Math.round(overallProgress),
        totalNormalizedScore: totalScore,
        classRank: 0, // Calculado posteriormente
        completedModules,
        totalTimeSpent,

        ...engagementMetrics,
        
        moduleProgress,
        badges: await this.getStudentBadges(studentId),
        achievements: await this.getStudentAchievements(studentId),
        notes: enrollmentData.notes,
        
        // Campos para compatibilidade e UI
        moduleScores: moduleScores,
        normalizedScore: totalScore,
        name: userData.fullName || userData.name || enrollmentData.studentName,
        totalScore: totalScore,
      }

      console.log(`[getStudentDetailedProgress] ✅ Progresso detalhado de ${studentId} montado com sucesso. Score: ${totalScore}`)
      return studentOverview

    } catch (error) {
      console.error(`[getStudentDetailedProgress] ❌ Erro crítico ao buscar progresso detalhado para ${studentId} na turma ${classId}:`, error)
      return null
    }
  }

  // NOVO: Método auxiliar para buscar progresso legado dos módulos
  private static async getLegacyModuleProgress(studentId: string): Promise<StudentModuleProgress[]> {
    const moduleProgressQuery = query(
      collection(db, 'student_module_progress'),
      where('studentId', '==', studentId)
    )
    const moduleProgressSnapshot = await getDocs(moduleProgressQuery)
    const progressList: StudentModuleProgress[] = []

    for (const moduleDoc of moduleProgressSnapshot.docs) {
      const moduleData = moduleDoc.data()
      const module = modules.find(m => m.id === moduleData.moduleId)
      if (module) {
        const exerciseProgress = await this.getStudentExerciseProgress(studentId, moduleData.moduleId)
        const moduleProgressData: StudentModuleProgress = {
          moduleId: moduleData.moduleId,
          moduleName: module.title,
          progress: moduleData.progress || 0,
          score: moduleData.score || 0,
          maxScore: moduleData.maxScore || (Array.isArray(module.exercises) ? module.exercises.reduce((sum, ex) => sum + ex.points, 0) : 0),
          timeSpent: moduleData.timeSpent || 0,
          completedExercises: exerciseProgress.filter(ex => ex.completed).length,
          totalExercises: Array.isArray(module.exercises) ? module.exercises.length : 0,
          attempts: moduleData.attempts || 0,
          bestScore: moduleData.bestScore || moduleData.score || 0,
          lastAttempt: parseFirebaseDate(moduleData.lastAttempt),
          isCompleted: moduleData.isCompleted || false,
          exercises: exerciseProgress
        }
        progressList.push(moduleProgressData)
      }
    }
    return progressList
  }

  // NOVO: Método para consolidar métricas de diferentes fontes
  private static consolidateStudentMetrics(
    unifiedScore: any,
    moduleProgress: StudentModuleProgress[]
  ) {
    let totalScore = 0
    let completedModules = 0
    let totalTimeSpent = 0
    let overallProgress = 0
    let moduleScores: { [key: string]: number } = {}

    if (unifiedScore && unifiedScore.moduleScores) {
      console.log("[consolidateStudentMetrics] 🚀 Usando dados do sistema unificado.")
      moduleScores = unifiedScore.moduleScores
      totalScore = Object.values(moduleScores).reduce((sum: number, score: any) => sum + (score.score || score || 0), 0)
      completedModules = Object.values(moduleScores).filter((score: any) => (score.score || score || 0) >= 70).length
      overallProgress = unifiedScore.normalizedScore || 0
    } else {
      console.log("[consolidateStudentMetrics] ⚠️ Usando dados legados para cálculo.")
      if (moduleProgress.length > 0) {
        const totalMaxScore = moduleProgress.reduce((sum, m) => sum + m.maxScore, 0)
        totalScore = moduleProgress.reduce((sum, m) => sum + m.score, 0)
        completedModules = moduleProgress.filter(m => m.isCompleted).length
        totalTimeSpent = moduleProgress.reduce((sum, m) => sum + m.timeSpent, 0)
        overallProgress = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0
        moduleProgress.forEach(m => {
          moduleScores[m.moduleId] = m.score
        })
      }
    }
    
    return { totalScore, completedModules, totalTimeSpent, overallProgress, moduleScores }
  }
  
  // Obter progresso detalhado dos exercícios de um estudante
  static async getStudentExerciseProgress(
    studentId: string,
    moduleId: string
  ): Promise<StudentExerciseProgress[]> {
    try {
      const exerciseProgressQuery = query(
        collection(db, 'student_exercise_progress'),
        where('studentId', '==', studentId),
        where('moduleId', '==', moduleId)
      )
      
      const exerciseProgressSnapshot = await getDocs(exerciseProgressQuery)
      const exerciseProgress: StudentExerciseProgress[] = []
      
      const module = modules.find(m => m.id === moduleId)
      if (!module) return []
      
      for (const exercise of module.exercises) {
        const progressDoc = exerciseProgressSnapshot.docs.find(
          doc => doc.data().exerciseId === exercise.id
        )
        
        if (progressDoc) {
          const data = progressDoc.data()
          exerciseProgress.push({
            exerciseId: exercise.id,
            exerciseTitle: exercise.title,
            completed: data.completed || false,
            score: data.score || 0,
            maxScore: data.maxScore || exercise.points,
            attempts: data.attempts || 0,
            timeSpent: data.timeSpent || 0,
            hintsUsed: data.hintsUsed || 0,
            lastAttempt: data.lastAttempt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            correctAnswers: data.correctAnswers || 0,
            totalQuestions: data.totalQuestions || 0,
            accuracy: data.accuracy || 0,
            improvement: data.improvement || 0
          })
        } else {
          // Exercício não iniciado
          exerciseProgress.push({
            exerciseId: exercise.id,
            exerciseTitle: exercise.title,
            completed: false,
            score: 0,
            maxScore: exercise.points,
            attempts: 0,
            timeSpent: 0,
            hintsUsed: 0,
            lastAttempt: new Date(),
            correctAnswers: 0,
            totalQuestions: 0,
            accuracy: 0,
            improvement: 0
          })
        }
      }
      
      return exerciseProgress
      
    } catch (error) {
      console.error('Erro ao buscar progresso dos exercícios:', error)
      return []
    }
  }
  
  // Calcular analytics da turma
  static async calculateClassAnalytics(classId: string): Promise<ClassAnalytics | null> {
    try {
      const students = await this.getClassStudentsBasic(classId)
      
      if (students.length === 0) {
        return null
      }
      
      // Calcular métricas básicas
      const totalStudents = students.length
      const activeStudents = students.filter(s => 
        (Date.now() - this.getLastActivityTimestamp(s.lastActivity)) < 7 * 24 * 60 * 60 * 1000
      ).length
      
      const progressSum = students.reduce((sum, s) => sum + s.overallProgress, 0)
      const scoreSum = students.reduce((sum, s) => sum + s.totalNormalizedScore, 0)
      
      const averageProgress = Math.round(progressSum / totalStudents)
      const averageScore = Math.round(scoreSum / totalStudents)
      
      // Calcular outras métricas
      const completedModules = students.reduce((sum, s) => sum + s.completedModules, 0)
      const totalTimeSpent = students.reduce((sum, s) => sum + s.totalTimeSpent, 0)
      
      // Distribuição de progresso
      const progressDistribution = this.calculateProgressDistribution(students)
      
      // Estatísticas por módulo
      const moduleStats = await this.calculateModuleStats(classId)
      
      // Exercícios com mais dificuldade
      const difficultExercises = await this.identifyDifficultExercises(classId)
      
      // Métricas de engajamento
      const engagementMetrics = await this.calculateClassEngagement(classId)
      
      return {
        id: `analytics_${classId}_${Date.now()}`,
        classId,
        date: new Date(),
        totalStudents,
        activeStudents,
        averageProgress,
        averageScore,
        completedModules,
        totalTimeSpent,
        dailyActiveUsers: engagementMetrics.dailyActive,
        weeklyActiveUsers: engagementMetrics.weeklyActive,
        sessionDuration: engagementMetrics.averageSessionTime,
        retentionRate: engagementMetrics.retentionRate,
        progressDistribution,
        moduleStats,
        difficultExercises,
        engagementMetrics: {
          peakHours: engagementMetrics.peakHours,
          weeklyPattern: engagementMetrics.weeklyPattern,
          averageSessionsPerWeek: engagementMetrics.averageSessionsPerWeek,
          dropoffPoints: engagementMetrics.dropoffPoints
        }
      } as ClassAnalytics
      
    } catch (error) {
      console.error('Erro ao calcular analytics da turma:', error)
      return null
    }
  }
  
  // Remover estudante da turma
  static async removeStudentFromClass(
    classId: string, 
    studentId: string, 
    reason?: string
  ): Promise<boolean> {
    try {
      const batch = writeBatch(db)
      
      // Atualizar status da matrícula
      const enrollmentQuery = query(
        collection(db, 'class_enrollments'),
        where('classId', '==', classId),
        where('studentId', '==', studentId)
      )
      
      const enrollmentSnapshot = await getDocs(enrollmentQuery)
      
      if (!enrollmentSnapshot.empty) {
        const enrollmentDoc = enrollmentSnapshot.docs[0]
        batch.update(enrollmentDoc.ref, {
          status: 'removed',
          removedAt: Timestamp.now(),
          removalReason: reason
        })
      }
      
      // Log da ação
      const logRef = doc(collection(db, 'class_logs'))
      batch.set(logRef, {
        classId,
        action: 'student_removed',
        studentId,
        reason,
        timestamp: Timestamp.now()
      })
      
      await batch.commit()
      return true
      
    } catch (error) {
      console.error('Erro ao remover estudante:', error)
      return false
    }
  }
  
  // Atualizar configurações da turma
  static async updateClassSettings(
    classId: string, 
    settings: Partial<EnhancedClass>
  ): Promise<boolean> {
    try {
      const classRef = doc(db, 'classes', classId)
      
      await updateDoc(classRef, {
        ...settings,
        updatedAt: Timestamp.now()
      })
      
      return true
      
    } catch (error) {
      console.error('Erro ao atualizar configurações da turma:', error)
      return false
    }
  }
  
  // Exportar dados da turma
  static async exportClassData(
    classId: string, 
    format: 'csv' | 'excel' | 'pdf' = 'csv'
  ): Promise<ClassExportData> {
    try {
      const classInfo = await this.getEnhancedClassInfo(classId)
      const students = await this.getEnhancedClassStudents(classId)
      const analytics = await this.calculateClassAnalytics(classId)
      const rankings = await this.getClassRankings(classId)
      
      return {
        classInfo: classInfo!,
        students,
        analytics: analytics!,
        rankings: rankings!,
        exportDate: new Date(),
        format
      }
      
    } catch (error) {
      console.error('Erro ao exportar dados da turma:', error)
      throw error
    }
  }
  
  // Métodos auxiliares privados
  
  // Função utilitária para converter lastActivity para timestamp (usando dateUtils seguro)
  private static getLastActivityTimestamp(lastActivity: any): number {
    if (!lastActivity) {
      return Date.now()
    }
    
    // Usar função segura do dateUtils
    const parsedDate = parseFirebaseDate(lastActivity)
    if (parsedDate) {
      return parsedDate.getTime()
    }
    
    // Se é um número (timestamp)
    if (typeof lastActivity === 'number') {
      return lastActivity
    }
    
    // Fallback para agora
    return Date.now()
  }

  // Buscar estudantes básicos de uma turma (otimizado)
  static async getClassStudentsBasic(classId: string): Promise<BasicStudent[]> {
    try {
      console.log(`[getClassStudentsBasic] 🔄 Buscando estudantes básicos para turma: ${classId}`)
      
      // Query direta e otimizada
      const q = query(
        collection(db, 'classStudents'),
        where('classId', '==', classId),
        where('status', 'in', ['active', 'inactive'])
      )
      
      const snapshot = await getDocs(q)
      
      if (snapshot.empty) {
        console.log(`[getClassStudentsBasic] ❌ Nenhum estudante encontrado para turma ${classId}`)
        return []
      }
      
      const students = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName || data.name,
          studentEmail: data.studentEmail || data.email,
          status: data.status,
          enrolledAt: data.enrolledAt?.toDate(),
          lastActivity: data.lastActivity?.toDate()
        }
      }).filter(student => student.studentId && student.studentName)
      
      console.log(`[getClassStudentsBasic] ✅ ${students.length} estudantes encontrados`)
      return students
      
    } catch (error) {
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.warn(`[getClassStudentsBasic] ⚠️ Índice requerido. Criando em: https://console.firebase.google.com/v1/r/project/vireiestatistica-ba7c5/firestore/indexes`)
        return []
      }
      
      console.error('Erro ao buscar estudantes básicos:', error)
      return []
    }
  }
  
  private static getDefaultClassSettings() {
    return {
      allowLateSubmissions: true,
      showRanking: true,
      enableCollaboration: false,
      modulesAvailable: ["module-1", "module-2", "module-3", "module-4"],
      autoGrading: true,
      requireApproval: false
    };
  }
  
  private static applyFilters(
    students: EnhancedStudentOverview[],
    filter: ClassFilter
  ): EnhancedStudentOverview[] {
    // Verificar se students é um array válido
    if (!Array.isArray(students)) {
      console.warn('applyFilters: students não é um array válido', students)
      return []
    }

    let filtered = [...students]

    if (filter.status && filter.status !== 'all') {
      filtered = filtered.filter(s => s && s.status === filter.status)
    }

    if (filter.progressRange) {
      filtered = filtered.filter(s =>
        s &&
        typeof s.overallProgress === 'number' &&
        s.overallProgress >= filter.progressRange!.min &&
        s.overallProgress <= filter.progressRange!.max
      )
    }

    if (filter.search) {
      const search = filter.search.toLowerCase()
      filtered = filtered.filter(s =>
        s &&
        ((s.studentName && s.studentName.toLowerCase().includes(search)) ||
         (s.email && s.email.toLowerCase().includes(search)))
      )
    }

    if (filter.sortBy) {
      filtered.sort((a, b) => {
        if (!a || !b) return 0

        const aVal = a[filter.sortBy as keyof EnhancedStudentOverview] as any
        const bVal = b[filter.sortBy as keyof EnhancedStudentOverview] as any

        if (filter.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
    }

    return filtered || []
  }
  
  private static calculateClassRankings(
    students: EnhancedStudentOverview[]
  ): EnhancedStudentOverview[] {
    // Verificar se students é um array válido
    if (!Array.isArray(students) || students.length === 0) {
      console.warn('calculateClassRankings: students não é um array válido ou está vazio', students)
      return []
    }

    const sorted = [...students].sort((a, b) => {
      const scoreA = a?.totalNormalizedScore || 0
      const scoreB = b?.totalNormalizedScore || 0
      return scoreB - scoreA
    })

    return sorted.map((student, index) => ({
      ...student,
      classRank: index + 1
    }))
  }
  
  private static async calculateStudentEngagement(studentId: string) {
    // Implementar cálculo de métricas de engajamento
    return {
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionTime: 0
    }
  }
  
  private static async getStudentBadges(studentId: string): Promise<string[]> {
    // Implementar busca de badges
    return []
  }
  
  private static async getStudentAchievements(studentId: string) {
    // Implementar busca de conquistas
    return []
  }
  
  private static calculateProgressDistribution(students: EnhancedStudentOverview[]) {
    const ranges = ['0-25%', '25-50%', '50-75%', '75-100%']
    return ranges.map(range => {
      const [min, max] = range.split('-').map(s => parseInt(s.replace('%', '')))
      const count = students.filter(s => s.overallProgress >= min && s.overallProgress < max).length
      return { range, count }
    })
  }
  
  private static async calculateModuleStats(classId: string) {
    // Implementar cálculo de estatísticas por módulo
    return []
  }
  
  private static async identifyDifficultExercises(classId: string) {
    // Implementar identificação de exercícios difíceis
    return []
  }
  
  private static async calculateClassEngagement(classId: string) {
    // Implementar cálculo de engagement da turma
    return {
      dailyActive: 0,
      weeklyActive: 0,
      averageSessionTime: 0,
      retentionRate: 0,
      peakHours: [],
      weeklyPattern: [],
      averageSessionsPerWeek: 0,
      dropoffPoints: []
    }
  }
  
  private static async getClassRankings(classId: string) {
    // Implementar busca de rankings
    return {
      classId,
      rankings: {
        overall: [],
        byModule: {},
        byEngagement: [],
        byImprovement: []
      },
      lastUpdated: new Date()
    }
  }
  
  // Obter todas as turmas de um professor específico (incluindo excluídas)
  static async getAllClasses(): Promise<EnhancedClass[]> {
    try {
      console.log(`[EnhancedClassService] 🔍 Buscando TODAS as turmas do sistema (não apenas do professor)`)
      
      let classesSnapshot;
      
      try {
        // Tentar query com orderBy primeiro
        const classesQuery = query(
          collection(db, 'classes'),
          orderBy('createdAt', 'desc')
        )
        classesSnapshot = await getDocs(classesQuery)
      } catch (orderError) {
        console.warn(`[EnhancedClassService] ⚠️ OrderBy falhou, tentando sem orderBy:`, orderError)
        
        // Fallback: buscar sem orderBy
        const classesQuery = query(collection(db, 'classes'))
        classesSnapshot = await getDocs(classesQuery)
      }
      
      const allSystemClasses: EnhancedClass[] = []
      
      console.log(`[EnhancedClassService] 📊 ${classesSnapshot.docs.length} turmas encontradas no total`)
      
      // Processar cada turma
      for (const classDoc of classesSnapshot.docs) {
        const classData = classDoc.data()
        
        // DEBUG: Log do status de cada turma
        console.log(`[EnhancedClassService] 🔍 Turma ${classData.name}: status="${classData.status}"`)
        
        // CORRIGIDO: Tratar status 'archived' e 'deleted'
        if (classData.status === 'deleted' || classData.status === 'archived') {
          console.log(`[EnhancedClassService] ❌ Turma ${classData.name} IGNORADA (status: ${classData.status})`)
          continue;
        }
        
        // Calcular estatísticas básicas da turma
        const students = await this.getClassStudentsBasic(classDoc.id)
        const analytics = await this.calculateClassAnalytics(classDoc.id)
        
        const enhancedClass: EnhancedClass = {
          id: classDoc.id,
          name: classData.name,
          description: classData.description,
          semester: classData.semester,
          year: classData.year,
          inviteCode: classData.inviteCode,
          professorId: classData.professorId,
          professorName: classData.professorName,
          status: classData.status || 'open',
          maxStudents: classData.maxStudents,
          acceptingNewStudents: classData.acceptingNewStudents ?? true,
          createdAt: classData.createdAt?.toDate() || new Date(),
          updatedAt: classData.updatedAt?.toDate() || new Date(),
          settings: classData.settings || this.getDefaultClassSettings(),
          
          // Estatísticas calculadas
          studentsCount: students.length,
          activeStudents: students.filter(s => s.status === 'active' && 
            (Date.now() - this.getLastActivityTimestamp(s.lastActivity)) < 7 * 24 * 60 * 60 * 1000).length,
          totalModules: Array.isArray(modules) ? modules.length : 4,
          avgProgress: analytics?.averageProgress || 0,
          avgScore: analytics?.averageScore || 0,
          lastActivity: analytics?.date
        }
        
        allSystemClasses.push(enhancedClass)
      }
      
      console.log(`[EnhancedClassService] ✅ ${allSystemClasses.length} turmas ativas processadas com sucesso`)
      return allSystemClasses
      
    } catch (error) {
      console.error('[EnhancedClassService] ❌ Erro ao buscar turmas do professor:', error)
      return []
    }
  }

  // Métodos alias para compatibilidade com as páginas
  static async getClassById(classId: string) {
    return this.getEnhancedClassInfo(classId)
  }
  
  static async getClassStudents(classId: string) {
    return this.getEnhancedClassStudents(classId)
  }
  
  static async getClassAnalytics(classId: string) {
    return this.calculateClassAnalytics(classId)
  }
  
  static async getStudentDetail(classId: string, studentId: string) {
    try {
      // Buscar dados do estudante na turma na coleção 'classStudents'
      const enrollmentDoc = await getDoc(doc(db, 'classStudents', `${classId}_${studentId}`))
      
      if (!enrollmentDoc.exists()) {
        return null
      }
      
      const enrollment = enrollmentDoc.data()
      
      // Buscar dados do usuário
      const userDoc = await getDoc(doc(db, 'users', studentId))
      if (!userDoc.exists()) {
        return null
      }
      
      const userData = userDoc.data()
      
      // Buscar progresso do estudante
      const progressDoc = await getDoc(doc(db, 'user_progress', studentId))
      const progressData = progressDoc.exists() ? progressDoc.data() : {}
      
      // Buscar dados da turma
      const classData = await this.getClassById(classId)
      
      // Calcular estatísticas
      const totalScore = Object.values(progressData.gameProgress || {}).reduce((sum: number, game: any) => sum + (game.score || 0), 0)
      const completedModules = Object.values(progressData.gameProgress || {}).filter((game: any) => game.completed).length
      
      return {
        student: {
          id: studentId,
          name: userData.name || userData.fullName || enrollment.studentName || 'Usuário Anônimo',
          email: userData.email || enrollment.email || enrollment.studentEmail,
          status: enrollment.status || 'active',
          enrolledAt: enrollment.enrolledAt?.toDate() || enrollment.registeredAt?.toDate() || new Date(),
          totalScore,
          completedModules,
          lastActivity: userData.lastActivity?.toDate()
        },
        progress: {
          modules: progressData.gameProgress || {},
          overallProgress: (completedModules / 4) * 100,
          totalScore
        },
        analytics: {
          totalTimeSpent: progressData.totalTimeSpent || 0,
          averageScore: totalScore / Math.max(completedModules, 1),
          correctAnswers: progressData.correctAnswers || 0,
          totalAttempts: progressData.totalAttempts || 0,
          hintsUsed: progressData.hintsUsed || 0,
          studySessions: progressData.studySessions || 0,
          classRank: 1, // Calcular ranking real
          preferredStudyTime: 'Manhã',
          mostActiveDay: 'Segunda-feira',
          avgSessionTime: 45,
          consistencyScore: 0.8
        },
        classData,
        classAverages: {
          avgScore: 75,
          avgProgress: 60,
          avgTimeSpent: 120
        }
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do estudante:', error)
      return null
    }
  }
  
  static async getAdvancedAnalytics(classId: string, period: string = '30d') {
    try {
      const classInfo = await this.getClassById(classId)
      const analytics = await this.getClassAnalytics(classId)
      
      // Gerar dados mockados para demonstração
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
      
      const timeSeriesData = Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        activeStudents: Math.floor(Math.random() * 20) + 10,
        avgScore: Math.floor(Math.random() * 40) + 60,
        completedExercises: Math.floor(Math.random() * 15) + 5,
        timeSpent: Math.floor(Math.random() * 120) + 60
      }))
      
      const modulePerformance = [
        { module: 'Módulo 1', avgScore: 85, completionRate: 95, avgTimeSpent: 45, difficultyScore: 3, studentCount: 28 },
        { module: 'Módulo 2', avgScore: 78, completionRate: 88, avgTimeSpent: 52, difficultyScore: 4, studentCount: 25 },
        { module: 'Módulo 3', avgScore: 72, completionRate: 75, avgTimeSpent: 58, difficultyScore: 5, studentCount: 21 },
        { module: 'Módulo 4', avgScore: 80, completionRate: 68, avgTimeSpent: 62, difficultyScore: 4, studentCount: 19 }
      ]
      
      const studentDistribution = [
        { scoreRange: '90-100', count: 5, percentage: 17 },
        { scoreRange: '80-89', count: 8, percentage: 27 },
        { scoreRange: '70-79', count: 10, percentage: 33 },
        { scoreRange: '60-69', count: 5, percentage: 17 },
        { scoreRange: '0-59', count: 2, percentage: 6 }
      ]
      
      const insights = [
        {
          type: 'success' as const,
          title: 'Excelente Engajamento',
          description: 'A turma apresenta 95% de taxa de participação ativa nos últimos 7 dias.',
          metric: 95,
          trend: 'up' as const
        },
        {
          type: 'warning' as const,
          title: 'Módulo 3 com Dificuldades',
          description: 'Taxa de conclusão 20% menor que a média. Considere revisão do conteúdo.',
          metric: 75,
          trend: 'down' as const
        },
        {
          type: 'info' as const,
          title: 'Horário de Pico',
          description: 'Maior atividade entre 14h-16h. Ideal para sessões ao vivo.',
          trend: 'stable' as const
        }
      ]
      
      return {
        classInfo,
        analytics,
        timeSeriesData,
        modulePerformance,
        engagementMetrics: {
          dailyActiveUsers: 15,
          weeklyActiveUsers: 28,
          avgSessionTime: 35,
          retentionRate: 92,
          dropoffPoints: ['Módulo 3 - Exercício 2', 'Módulo 4 - Introdução']
        },
        activityHeatmap: [],
        studentDistribution,
        insights
      }
    } catch (error) {
      console.error('Erro ao buscar analytics avançados:', error)
      return null
    }
  }
  
  // Obter todas as turmas de um professor específico (método necessário para ImprovedClassManagement)
  static async getProfessorClasses(professorId: string): Promise<EnhancedClass[]> {
    try {
      console.log(`[EnhancedClassService] 🔍 Buscando turmas do professor: ${professorId}`)
      
      let professorsClasses: EnhancedClass[] = []
      
      try {
        // Tentativa 1: Query otimizada por professorId e status
        const optimizedQuery = query(
          collection(db, 'classes'),
          where('professorId', '==', professorId),
          where('status', 'in', ['open', 'closed']),
          orderBy('createdAt', 'desc')
        )
        
        const querySnapshot = await getDocs(optimizedQuery)
        
        if (querySnapshot.size > 0) {
          console.log(`[EnhancedClassService] ✅ Query otimizada encontrou ${querySnapshot.size} turmas`)
          
          for (const classDoc of querySnapshot.docs) {
            const classData = classDoc.data()
            
            // Calcular estatísticas básicas
            const students = await this.getClassStudentsBasic(classDoc.id)
            const analytics = await this.calculateClassAnalytics(classDoc.id)
            
            const enhancedClass: EnhancedClass = {
              id: classDoc.id,
              name: classData.name,
              description: classData.description,
              semester: classData.semester,
              year: classData.year,
              inviteCode: classData.inviteCode,
              professorId: classData.professorId,
              professorName: classData.professorName,
              status: classData.status || 'open',
              maxStudents: classData.maxStudents,
              acceptingNewStudents: classData.acceptingNewStudents ?? true,
              createdAt: classData.createdAt?.toDate() || new Date(),
              updatedAt: classData.updatedAt?.toDate() || new Date(),
              settings: classData.settings || this.getDefaultClassSettings(),
              
              // Estatísticas calculadas
              studentsCount: students.length,
              activeStudents: students.filter(s => s.status === 'active' && 
                (Date.now() - this.getLastActivityTimestamp(s.lastActivity)) < 7 * 24 * 60 * 60 * 1000).length,
              totalModules: Array.isArray(modules) ? modules.length : 4,
              avgProgress: analytics?.averageProgress || 0,
              avgScore: analytics?.averageScore || 0,
              lastActivity: analytics?.date
            }
            
            professorsClasses.push(enhancedClass)
          }
          
          console.log(`[EnhancedClassService] ✅ ${professorsClasses.length} turmas do professor carregadas`)
          return professorsClasses
        }
      } catch (queryError) {
        console.warn(`[EnhancedClassService] ⚠️ Query otimizada falhou, usando fallback:`, queryError)
      }
      
      // Fallback: Buscar todas as turmas e filtrar por professorId
      console.log(`[EnhancedClassService] 🔄 Usando fallback - buscando todas as turmas`)
      const allClasses = await this.getAllClasses()
      
      professorsClasses = allClasses.filter(cls => cls.professorId === professorId)
      
      console.log(`[EnhancedClassService] ✅ Fallback encontrou ${professorsClasses.length} turmas do professor`)
      return professorsClasses
      
    } catch (error) {
      console.error(`[EnhancedClassService] ❌ Erro ao buscar turmas do professor ${professorId}:`, error)
      return []
    }
  }
  
  static async removeStudentFromClass(classId: string, studentId: string) {
    try {
      // Buscar o enrollment na coleção 'classStudents'
      const enrollmentRef = doc(db, 'classStudents', `${classId}_${studentId}`)
      const enrollmentDoc = await getDoc(enrollmentRef)
      
      if (enrollmentDoc.exists()) {
        await updateDoc(enrollmentRef, {
          status: 'removed',
          removedAt: Timestamp.now()
        })
      }
      
      return true
    } catch (error) {
      console.error('Erro ao remover estudante:', error)
      throw error
    }
  }
}

export default EnhancedClassService

// Exportação nomeada para permitir destructuring
export const enhancedClassService = EnhancedClassService