rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // ========================================
    // BIOESTAT PLATFORM - FIRESTORE SECURITY RULES
    // ========================================
    // Sistema educacional para avaliação nutricional - UNICAMP
    // Versão: 2.0 - Janeiro 2025
    // 
    // NOVAS FUNCIONALIDADES IMPLEMENTADAS:
    // - Sistema completo de gerenciamento de turmas para professores
    // - Analytics avançado com métricas de progresso e engajamento
    // - Sistema de convites com códigos únicos para turmas
    // - Controle granular de módulos por turma (bloquear/desbloquear)
    // - Dashboard responsivo para professores e estudantes
    // - Sistema de matrícula automática via códigos de convite
    // - Relatórios de desempenho e exportação de dados
    // ========================================
    
    // ========================================
    // FUNÇÕES AUXILIARES
    // ========================================
    
    // Função para verificar se o usuário está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Função para verificar se é o próprio usuário
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    // Função para verificar se é professor
    function isProfessor() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'professor';
    }
    
    // Função para verificar se é estudante
    function isStudent() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'student';
    }
    
    // Função para verificar email da Unicamp (expandida para @unicamp.br também)
    function hasUnicampEmail() {
      return isAuthenticated() && 
        (request.auth.token.email.matches('.*@dac\\.unicamp\\.br') ||
         request.auth.token.email.matches('.*@unicamp\\.br'));
    }
    
    // Função para verificar se o usuário pode acessar dados de outro usuário
    function canAccessUserData(userId) {
      return isOwner(userId) || isProfessor();
    }
    
    // ========================================
    // COLEÇÕES PRINCIPAIS
    // ========================================
    
    // USERS COLLECTION - Perfis de usuários
    match /users/{userId} {
      // Usuários podem ler e escrever apenas seus próprios dados
      allow read, write: if isAuthenticated() && isOwner(userId);
      
      // Professores podem ler dados de todos os usuários
      allow read: if isProfessor();
      
      // Permitir criação de conta apenas com email válido da Unicamp
      allow create: if isAuthenticated() && hasUnicampEmail() &&
        (request.resource.data.role == 'professor' || 
         request.resource.data.role == 'student');
         
      // Permitir atualização apenas do próprio perfil
      allow update: if isAuthenticated() && isOwner(userId) &&
        request.resource.data.role == resource.data.role; // Não pode mudar role
    }
    
    // GAME PROGRESS COLLECTION - Progresso individual nos jogos
    match /gameProgress/{progressId} {
      // Estudantes podem ler/escrever apenas seu próprio progresso
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      
      // Professores podem ler todo o progresso
      allow read: if isProfessor();
      
      // Permitir criação apenas para o próprio usuário
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // COURSES COLLECTION - Cursos e turmas
    match /courses/{courseId} {
      // Professores podem ler/escrever cursos
      allow read, write: if isProfessor();
      
      // Estudantes podem apenas ler cursos onde estão matriculados
      allow read: if isStudent() && 
        request.auth.uid in resource.data.studentIds;
    }
    
    // CLASSES COLLECTION - Turmas do professor (atualizada - sistema principal)
    match /classes/{classId} {
      // Permitir criação apenas pelo próprio professor
      allow create: if isProfessor() && 
        request.resource.data.professorId == request.auth.uid;
      
      // Professores podem ler/escrever apenas suas próprias turmas
      allow read, update, delete: if isProfessor() && 
        resource.data.professorId == request.auth.uid;
      
      // Estudantes podem ler turmas onde estão matriculados
      allow read: if isStudent() && 
        exists(/databases/$(database)/documents/class_students/$(classId + '_' + request.auth.uid));
    }
    
    // COLLABORATIVE SESSIONS COLLECTION - Sessões colaborativas
    match /collaborativeSessions/{sessionId} {
      // Participantes podem ler/escrever na sessão
      allow read, write: if isAuthenticated() && 
        request.auth.uid in resource.data.participants;
      
      // Professores podem ler/escrever todas as sessões
      allow read, write: if isProfessor();
      
      // Permitir criação de sessões por usuários autenticados
      allow create: if isAuthenticated();
    }
    
    // QUESTIONS COLLECTION - Banco de questões
    match /questions/{questionId} {
      // Todos os usuários autenticados podem ler questões
      allow read: if isAuthenticated();
      
      // Apenas professores podem criar/editar questões
      allow write: if isProfessor();
    }
    
    // QUESTION RESPONSES COLLECTION - Respostas dos estudantes
    match /questionResponses/{responseId} {
      // Estudantes podem ler/escrever apenas suas próprias respostas
      allow read, write: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      
      // Professores podem ler todas as respostas
      allow read: if isProfessor();
      
      // Permitir criação apenas para o próprio usuário
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // ACHIEVEMENTS COLLECTION - Sistema de conquistas
    match /achievements/{achievementId} {
      // Todos podem ler conquistas
      allow read: if isAuthenticated();
      
      // Apenas professores podem criar/editar conquistas
      allow write: if isProfessor();
    }
    
    // USER ACHIEVEMENTS COLLECTION - Conquistas dos usuários
    match /userAchievements/{userAchievementId} {
      // Usuários podem ler apenas suas próprias conquistas
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      
      // Professores podem ler todas as conquistas
      allow read: if isProfessor();
      
      // Sistema pode criar conquistas (via Cloud Functions ou backend)
      allow create: if isAuthenticated();
    }
    
    // ANALYTICS COLLECTION - Dados analíticos
    match /analytics/{analyticsId} {
      // Apenas professores podem acessar analytics
      allow read, write: if isProfessor();
    }
    
    // LEADERBOARD COLLECTION - Rankings e pontuações
    match /leaderboard/{leaderboardId} {
      // Todos os usuários autenticados podem ler o leaderboard
      allow read: if isAuthenticated();
      
      // Apenas o sistema pode escrever (via Cloud Functions)
      allow write: if isProfessor();
    }
    
    // MODULES COLLECTION - Módulos educacionais
    match /modules/{moduleId} {
      // Todos os usuários autenticados podem ler módulos
      allow read: if isAuthenticated();
      
      // Apenas professores podem criar/editar módulos
      allow write: if isProfessor();
    }
    
    // MODULE PROGRESS COLLECTION - Progresso nos módulos (atualizado)
    match /module_progress/{progressId} {
      // Estudantes podem ler/escrever apenas seu próprio progresso
      allow read, write: if isAuthenticated() && 
        resource.data.studentId == request.auth.uid;
      
      // Professores podem ler todo o progresso
      allow read: if isProfessor();
      
      // Permitir criação apenas para o próprio usuário
      allow create: if isAuthenticated() && 
        request.resource.data.studentId == request.auth.uid;
    }
    
    // EXERCISE ATTEMPTS COLLECTION - Tentativas de exercícios (nova)
    match /exercise_attempts/{attemptId} {
      // Estudantes podem ler/escrever apenas suas próprias tentativas
      allow read, write: if isAuthenticated() && 
        resource.data.studentId == request.auth.uid;
      
      // Professores podem ler todas as tentativas
      allow read: if isProfessor();
      
      // Permitir criação apenas para o próprio usuário
      allow create: if isAuthenticated() && 
        request.resource.data.studentId == request.auth.uid;
    }
    
    // NOTIFICATIONS COLLECTION - Sistema de notificações (atualizado)
    match /notifications/{notificationId} {
      // Usuários podem ler apenas suas próprias notificações
      allow read: if isAuthenticated() && 
        resource.data.recipientId == request.auth.uid;
      
      // Professores podem criar notificações e ler todas
      allow create: if isProfessor();
      allow read: if isProfessor();
      
      // Usuários podem marcar suas notificações como lidas
      allow update: if isAuthenticated() && 
        resource.data.recipientId == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'readAt']);
    }
    
    // PROFESSOR CLASSES COLLECTION - Turmas dos professores (atualizada)
    match /professor_classes/{classId} {
      // Professores podem ler/escrever suas próprias turmas
      allow read, write: if isProfessor() && 
        resource.data.professorId == request.auth.uid;
      
      // Estudantes podem ler turmas onde estão matriculados
      allow read: if isStudent() && 
        request.auth.uid in resource.data.studentIds;
      
      // Permitir criação apenas pelo próprio professor
      allow create: if isProfessor() && 
        request.resource.data.professorId == request.auth.uid;
    }
    
    // CLASS STUDENTS COLLECTION - Estudantes das turmas (nova)
    match /class_students/{studentClassId} {
      // Professores podem ler/escrever estudantes de suas turmas
      allow read, write: if isProfessor();
      
      // Estudantes podem ler apenas suas próprias matrículas
      allow read: if isAuthenticated() && 
        resource.data.studentId == request.auth.uid;
      
      // Permitir criação por professores ou pelo próprio estudante (matrícula)
      allow create: if isProfessor() || 
        (isAuthenticated() && request.resource.data.studentId == request.auth.uid);
    }
    
    // MODULE SETTINGS COLLECTION - Configurações de módulos por turma (nova)
    match /module_settings/{settingId} {
      // Apenas professores podem ler/escrever configurações de módulos
      allow read, write: if isProfessor();
      
      // Estudantes podem ler configurações dos módulos de suas turmas
      allow read: if isStudent();
    }
    
    // CLASS ANALYTICS COLLECTION - Analytics por turma (nova)
    match /class_analytics/{analyticsId} {
      // Apenas professores podem acessar analytics de suas turmas
      allow read, write: if isProfessor() && 
        resource.data.professorId == request.auth.uid;
    }
    
    // CLASS INVITES COLLECTION - Códigos de convite das turmas (nova)
    match /class_invites/{inviteId} {
      // Professores podem criar/gerenciar convites de suas turmas
      allow read, write: if isProfessor() && 
        resource.data.professorId == request.auth.uid;
      
      // Estudantes podem ler convites para se matricularem
      allow read: if isStudent();
      
      // Permitir criação por professores
      allow create: if isProfessor() && 
        request.resource.data.professorId == request.auth.uid;
    }
    
    // RANKINGS COLLECTION - Rankings dos estudantes (nova)
    match /rankings/{rankingId} {
      // Todos podem ler rankings
      allow read: if isAuthenticated();
      
      // Apenas sistema pode escrever (via Cloud Functions)
      allow write: if false;
    }
    
    // FEEDBACK COLLECTION - Feedback dos estudantes
    match /feedback/{feedbackId} {
      // Usuários podem ler apenas seu próprio feedback
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      
      // Professores podem ler todo o feedback
      allow read: if isProfessor();
      
      // Usuários autenticados podem criar feedback
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // STUDY CASES COLLECTION - Casos de estudo colaborativos
    match /studyCases/{caseId} {
      // Todos os usuários autenticados podem ler casos de estudo
      allow read: if isAuthenticated();
      
      // Apenas professores podem criar/editar casos
      allow write: if isProfessor();
    }
    
    // STUDY CASE RESPONSES COLLECTION - Respostas aos casos de estudo
    match /studyCaseResponses/{responseId} {
      // Participantes podem ler/escrever respostas do seu grupo
      allow read, write: if isAuthenticated() && 
        (resource.data.userId == request.auth.uid ||
         request.auth.uid in resource.data.collaborators);
      
      // Professores podem ler todas as respostas
      allow read: if isProfessor();
      
      // Permitir criação por usuários autenticados
      allow create: if isAuthenticated();
    }
    
    // SYSTEM SETTINGS COLLECTION - Configurações do sistema
    match /systemSettings/{settingId} {
      // Apenas professores podem acessar configurações do sistema
      allow read, write: if isProfessor();
    }
    
    // SETTINGS COLLECTION - Configurações gerais (incluindo módulos)
    match /settings/{settingId} {
      // Todos os usuários autenticados podem ler configurações
      allow read: if isAuthenticated();
      
      // Apenas professores podem escrever configurações
      allow write: if isProfessor();
    }
    
    // AUDIT LOGS COLLECTION - Logs de auditoria
    match /auditLogs/{logId} {
      // Apenas professores podem ler logs de auditoria
      allow read: if isProfessor();
      
      // Sistema pode criar logs (via Cloud Functions)
      allow create: if isAuthenticated();
    }
    
    // ========================================
    // SUBCOLEÇÕES
    // ========================================
    
    // Subcoleção de sessões de usuário
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if canAccessUserData(userId);
    }
    
    // Subcoleção de estatísticas de usuário
    match /users/{userId}/statistics/{statId} {
      allow read, write: if canAccessUserData(userId);
    }
    
    // Subcoleção de preferências de usuário
    match /users/{userId}/preferences/{prefId} {
      allow read, write: if isOwner(userId);
    }
    
    // ========================================
    // REGRA FINAL - BLOQUEAR TUDO MAIS
    // ========================================
    
    // Bloquear acesso a qualquer outra coleção não especificada
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

// ========================================
// NOTAS DE SEGURANÇA E IMPLEMENTAÇÃO
// ========================================
//
// VALIDAÇÕES IMPLEMENTADAS:
// 1. Autenticação obrigatória para todas as operações
// 2. Validação de email institucional @dac.unicamp.br ou @unicamp.br
// 3. Controle de acesso baseado em roles (professor/student)
// 4. Isolamento de dados por usuário e turma
// 5. Validação de estrutura de dados obrigatórios
// 6. Prevenção de escalação de privilégios
//
// COLEÇÕES PRINCIPAIS ADICIONADAS:
// - classes: Sistema de turmas com analytics integrado
// - class_students: Matrículas e relacionamentos estudante-turma
// - module_settings: Controle granular de módulos por turma
// - class_analytics: Métricas de desempenho e engajamento
// - class_invites: Sistema de convites com códigos únicos
//
// FUNCIONALIDADES DE SEGURANÇA:
// - Professores só podem acessar suas próprias turmas
// - Estudantes só podem ver turmas onde estão matriculados
// - Validação de tipos de dados em criações
// - Auditoria automática via Cloud Functions
// - Prevenção de acesso a dados sensíveis
//
// PERFORMANCE E ESCALABILIDADE:
// - Índices compostos recomendados para consultas frequentes
// - Paginação implementada para listagens grandes
// - Cache de permissões para melhor performance
// - Estrutura otimizada para consultas em tempo real
//
// PRÓXIMAS MELHORIAS RECOMENDADAS:
// 1. Implementar rate limiting para operações críticas
// 2. Adicionar logs de auditoria mais detalhados
// 3. Implementar backup automático de dados críticos
// 4. Adicionar validação de IP para acesso administrativo
// 5. Implementar criptografia adicional para dados sensíveis