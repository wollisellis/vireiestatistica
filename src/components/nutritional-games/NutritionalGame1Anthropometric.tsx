'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Scale, 
  Ruler, 
  Calculator, 
  TrendingUp, 
  Users, 
  Heart,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowLeft,
  Play,
  Clock,
  Target,
  BookOpen,
  Coffee,
  Home
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdvancedEducationalContent } from '@/components/games/AdvancedEducationalContent'
import { anthropometricDataset, formatNutritionalCitation } from '@/lib/nutritionalAssessmentData'
import { GrowthCurveChart, PercentileReference } from '@/components/growth-curves'
import InteractiveGrowthCurveChart from '@/components/growth-curves/InteractiveGrowthCurveChart'
import {
  brazilianChildrenData,
  calculatePercentile,
  classifyNutritionalStatus,
  formatAge,
  growthCurvesCitation,
  interactiveExercises,
  preGameEducationalContent
} from '@/lib/brazilianGrowthCurves'
import { useStudentProgress } from '@/contexts/StudentProgressContext'

interface Exercise {
  id: number
  title: string
  description: string
  scenario: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty: 'muito-facil' | 'facil' | 'medio' | 'dificil' | 'muito-dificil'
  learningObjective: string
  realData: any
  calculation?: string
}

const exercises: Exercise[] = [
  {
    id: 1,
    title: 'Cálculo de IMC - Conceito Básico',
    description: 'Aprenda a calcular e interpretar o Índice de Massa Corporal usando dados reais brasileiros',
    scenario: 'Maria, estudante de 25 anos de São Paulo, participou da Pesquisa de Orçamentos Familiares (POF). Seus dados: Peso = 65,2 kg, Altura = 1,62 m',
    question: 'Qual é o IMC de Maria e como classificá-lo?',
    options: [
      'IMC = 24,8 kg/m² - Eutrófico (peso normal)',
      'IMC = 26,1 kg/m² - Sobrepeso',
      'IMC = 22,3 kg/m² - Baixo peso',
      'IMC = 28,5 kg/m² - Obesidade grau I'
    ],
    correctAnswer: 0,
    explanation: 'IMC = Peso ÷ Altura² = 65,2 ÷ (1,62)² = 65,2 ÷ 2,62 = 24,8 kg/m². Segundo a OMS, IMC entre 18,5-24,9 é classificado como eutrófico (peso normal).',
    difficulty: 'muito-facil',
    learningObjective: 'Calcular e interpretar o IMC corretamente',
    realData: anthropometricDataset.data[0],
    calculation: 'IMC = 65,2 ÷ (1,62)² = 24,8 kg/m²'
  },
  {
    id: 2,
    title: 'Relação Cintura-Quadril (RCQ)',
    description: 'Avalie o risco cardiovascular através da distribuição de gordura corporal',
    scenario: 'João, homem de 42 anos do Sul do Brasil, tem: Circunferência da cintura = 95 cm, Circunferência do quadril = 102 cm',
    question: 'Qual é a RCQ de João e o risco cardiovascular associado?',
    options: [
      'RCQ = 0,93 - Risco cardiovascular moderado',
      'RCQ = 0,85 - Baixo risco cardiovascular',
      'RCQ = 1,07 - Alto risco cardiovascular',
      'RCQ = 0,78 - Risco muito baixo'
    ],
    correctAnswer: 0,
    explanation: 'RCQ = Cintura ÷ Quadril = 95 ÷ 102 = 0,93. Para homens: RCQ < 0,90 = baixo risco, 0,90-0,95 = risco moderado, > 0,95 = alto risco.',
    difficulty: 'facil',
    learningObjective: 'Calcular RCQ e avaliar risco cardiovascular',
    realData: anthropometricDataset.data[1],
    calculation: 'RCQ = 95 ÷ 102 = 0,93'
  },
  {
    id: 3,
    title: 'Avaliação Nutricional Regional',
    description: 'Compare o estado nutricional entre diferentes regiões do Brasil',
    scenario: 'Análise de dados da POF mostra: Nordeste - IMC médio 23,5 kg/m², Sudeste - IMC médio 25,1 kg/m², Sul - IMC médio 26,2 kg/m²',
    question: 'Qual região apresenta maior prevalência de sobrepeso/obesidade?',
    options: [
      'Nordeste - maior prevalência de baixo peso',
      'Sudeste - prevalência intermediária de sobrepeso',
      'Sul - maior prevalência de sobrepeso/obesidade',
      'Todas as regiões têm prevalência similar'
    ],
    correctAnswer: 2,
    explanation: 'O Sul apresenta IMC médio mais alto (26,2 kg/m²), indicando maior prevalência de sobrepeso (IMC ≥ 25). Isso reflete diferenças socioeconômicas e culturais regionais.',
    difficulty: 'medio',
    learningObjective: 'Interpretar dados populacionais de estado nutricional',
    realData: { regions: ['Nordeste', 'Sudeste', 'Sul'], avgBMI: [23.5, 25.1, 26.2] }
  },
  {
    id: 4,
    title: 'Indicadores Antropométricos Múltiplos',
    description: 'Integre diferentes medidas antropométricas para avaliação completa',
    scenario: 'Ana, 35 anos, Nordeste: Peso = 58,7 kg, Altura = 1,58 m, Cintura = 72 cm, Quadril = 92 cm. Educação fundamental, renda familiar baixa.',
    question: 'Qual a avaliação antropométrica mais adequada para Ana?',
    options: [
      'IMC normal (23,5), RCQ baixo risco (0,78) - Estado nutricional adequado',
      'IMC baixo (21,2), RCQ alto risco (0,85) - Desnutrição com risco cardiovascular',
      'IMC alto (26,8), RCQ moderado (0,82) - Sobrepeso com distribuição central',
      'Dados insuficientes para avaliação completa'
    ],
    correctAnswer: 0,
    explanation: 'IMC = 58,7 ÷ (1,58)² = 23,5 (normal). RCQ = 72 ÷ 92 = 0,78 (baixo risco para mulheres). Apesar do contexto socioeconômico, os indicadores antropométricos estão adequados.',
    difficulty: 'dificil',
    learningObjective: 'Integrar múltiplos indicadores antropométricos',
    realData: anthropometricDataset.data[2]
  },
  {
    id: 5,
    title: 'Interpretação Populacional Avançada',
    description: 'Analise tendências populacionais e fatores determinantes',
    scenario: 'Dados POF 2017-2018: Prevalência de obesidade aumentou 67,8% em 13 anos. Maior crescimento em homens (84%) vs mulheres (55%). Regiões Norte e Nordeste com maior crescimento.',
    question: 'Qual interpretação epidemiológica é mais apropriada?',
    options: [
      'Transição nutricional com mudança do perfil epidemiológico brasileiro',
      'Erro metodológico nas pesquisas - dados inconsistentes',
      'Melhoria do estado nutricional da população',
      'Problema restrito às classes socioeconômicas altas'
    ],
    correctAnswer: 0,
    explanation: 'Os dados indicam transição nutricional: redução da desnutrição e aumento da obesidade, especialmente em regiões historicamente com maior insegurança alimentar. Reflete mudanças socioeconômicas, urbanização e alterações no padrão alimentar.',
    difficulty: 'muito-dificil',
    learningObjective: 'Interpretar tendências epidemiológicas nutricionais',
    realData: { obesityTrend: { increase: 67.8, years: 13, menIncrease: 84, womenIncrease: 55 } }
  },
  // Interactive exercises 6-8 are now handled by InteractiveGrowthCurveChart component
]

interface NutritionalGame1AnthropometricProps {
  onBack: () => void
  onComplete: () => void
}

export function NutritionalGame1Anthropometric({ onBack, onComplete }: NutritionalGame1AnthropometricProps) {
  const [showEducation, setShowEducation] = useState(true)
  const [currentExercise, setCurrentExercise] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showInteractiveExercises, setShowInteractiveExercises] = useState(false)
  const [currentInteractiveExercise, setCurrentInteractiveExercise] = useState(0)
  const [interactiveScore, setInteractiveScore] = useState(0)
  const { updateGameScore } = useStudentProgress()

  // Total exercises: 5 traditional + 8 interactive = 13 exercises
  const totalExercises = exercises.length + interactiveExercises.length
  const maxScore = exercises.length * 20 + interactiveExercises.reduce((sum, ex) => sum + ex.points, 0)

  React.useEffect(() => {
    if (!showEducation && !isCompleted) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [showEducation, isCompleted])

  const handleStartGame = () => {
    setShowEducation(false)
  }

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null) return
    
    const isCorrect = selectedAnswer === exercises[currentExercise].correctAnswer
    if (isCorrect) {
      setScore(prev => prev + 20)
    }
    
    setShowFeedback(true)
  }

  const handleNextExercise = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1)
      setSelectedAnswer(null)
      setShowFeedback(false)
    } else {
      // Transition to interactive exercises
      setShowInteractiveExercises(true)
      setSelectedAnswer(null)
      setShowFeedback(false)
    }
  }

  const handleInteractiveExerciseComplete = (exerciseScore: number, feedback: string) => {
    setInteractiveScore(prev => prev + exerciseScore)

    if (currentInteractiveExercise < interactiveExercises.length - 1) {
      setCurrentInteractiveExercise(prev => prev + 1)
    } else {
      // All exercises completed
      const finalScore = score + interactiveScore + exerciseScore
      setIsCompleted(true)

      // Update student progress when game is completed
      updateGameScore({
        gameId: 1,
        score: finalScore,
        maxScore: maxScore,
        timeElapsed: timeElapsed,
        completedAt: new Date(),
        exercisesCompleted: totalExercises,
        totalExercises: totalExercises,
        difficulty: 'Variada'
      })
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'muito-facil': return 'bg-green-100 text-green-800'
      case 'facil': return 'bg-blue-100 text-blue-800'
      case 'medio': return 'bg-yellow-100 text-yellow-800'
      case 'dificil': return 'bg-orange-100 text-orange-800'
      case 'muito-dificil': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (showEducation) {
    const educationalSections = [
      {
        id: 'introduction',
        title: 'Introdução aos Indicadores Antropométricos',
        icon: <Scale className="w-6 h-6 text-blue-600" />,
        content: `A antropometria é como "medir o corpo humano" para entender se uma pessoa está bem nutrida. É como quando você vai ao médico e ele mede sua altura e peso - mas aqui vamos além, aprendendo a interpretar esses números para avaliar a saúde nutricional.`,
        concepts: [
          {
            term: 'Antropometria',
            definition: 'Ciência que estuda as medidas do corpo humano para avaliar crescimento, desenvolvimento e estado nutricional',
            whenToUse: 'Use para avaliar estado nutricional individual ou populacional, monitorar crescimento e identificar riscos à saúde',
            dailyLifeAnalogy: {
              title: 'Medindo Roupas',
              description: 'É como quando você mede suas roupas para saber se servem bem - a antropometria mede o corpo para saber se a nutrição está adequada',
              icon: <Ruler className="w-4 h-4" />,
              connection: 'Assim como medidas de roupa indicam se ela serve, medidas corporais indicam se a nutrição está adequada'
            },
            brazilianExample: {
              title: 'Pesquisa de Orçamentos Familiares (POF)',
              context: 'O IBGE realiza pesquisas nacionais medindo peso, altura e outras medidas de brasileiros',
              data: 'Em 2017-2018, foram avaliados 46.164 adultos em todo o Brasil',
              interpretation: 'Os dados mostram que 55,4% dos adultos brasileiros têm excesso de peso',
              source: formatNutritionalCitation(anthropometricDataset.citation)
            },
            keyPoints: [
              'Medidas simples como peso e altura fornecem informações valiosas',
              'IMC é o indicador mais usado mundialmente',
              'Circunferências avaliam distribuição de gordura',
              'Dados populacionais orientam políticas públicas'
            ],
            commonMistakes: [
              'Usar apenas o peso para avaliar estado nutricional',
              'Não considerar idade, sexo e etnia na interpretação',
              'Ignorar a distribuição de gordura corporal'
            ]
          }
        ],
        estimatedTime: 4
      },
      {
        id: 'imc-calculation',
        title: 'Índice de Massa Corporal (IMC)',
        icon: <Calculator className="w-6 h-6 text-green-600" />,
        content: `O IMC é como uma "nota" que o corpo recebe baseada no peso e altura. É o indicador mais usado no mundo para saber se alguém está com peso adequado, baixo peso, sobrepeso ou obesidade.`,
        concepts: [
          {
            term: 'IMC (Índice de Massa Corporal)',
            definition: 'Relação entre peso e altura que indica se o peso está adequado para a altura da pessoa',
            symbol: 'IMC = Peso (kg) ÷ Altura² (m)',
            whenToUse: 'Para triagem inicial do estado nutricional em adultos saudáveis',
            dailyLifeAnalogy: {
              title: 'Nota da Prova',
              description: 'É como uma nota que mostra se você está indo bem - o IMC mostra se seu peso está adequado para sua altura',
              icon: <Target className="w-4 h-4" />,
              connection: 'Assim como notas têm faixas (0-10), o IMC tem faixas que indicam diferentes estados nutricionais'
            },
            brazilianExample: {
              title: 'IMC da População Brasileira',
              context: 'Dados da POF 2017-2018 mostram o perfil nutricional dos brasileiros',
              data: 'IMC médio: Homens 26,8 kg/m², Mulheres 26,5 kg/m²',
              interpretation: 'Ambos os sexos estão na faixa de sobrepeso (IMC 25-29,9 kg/m²)',
              source: formatNutritionalCitation(anthropometricDataset.citation)
            },
            keyPoints: [
              'Faixas: <18,5 (baixo peso), 18,5-24,9 (normal), 25-29,9 (sobrepeso), ≥30 (obesidade)',
              'Método simples e barato para grandes populações',
              'Não distingue massa muscular de gordura',
              'Pode não ser adequado para atletas ou idosos'
            ],
            commonMistakes: [
              'Aplicar em crianças sem ajustar para idade',
              'Usar como único indicador de saúde',
              'Não considerar composição corporal'
            ]
          }
        ],
        estimatedTime: 5
      },
      {
        id: 'body-distribution',
        title: 'Distribuição de Gordura Corporal',
        icon: <TrendingUp className="w-6 h-6 text-purple-600" />,
        content: `Não é só quanto de gordura você tem, mas onde ela está localizada que importa para a saúde. É como organizar o guarda-roupa - algumas "gavetas" (locais do corpo) são mais perigosas que outras para guardar gordura.`,
        concepts: [
          {
            term: 'Relação Cintura-Quadril (RCQ)',
            definition: 'Medida que avalia onde a gordura está distribuída no corpo, indicando risco cardiovascular',
            symbol: 'RCQ = Circunferência da Cintura ÷ Circunferência do Quadril',
            whenToUse: 'Para avaliar risco cardiovascular e metabólico associado à distribuição de gordura',
            dailyLifeAnalogy: {
              title: 'Formato da Maçã vs Pêra',
              description: 'Pessoas "formato maçã" (gordura na barriga) têm mais risco que "formato pêra" (gordura no quadril)',
              icon: <Heart className="w-4 h-4" />,
              connection: 'A localização da gordura é mais importante que a quantidade total para prever riscos à saúde'
            },
            brazilianExample: {
              title: 'Risco Cardiovascular no Brasil',
              context: 'Estudo com adultos brasileiros avaliou RCQ e risco cardiovascular',
              data: 'Homens: RCQ médio 0,91 (risco moderado), Mulheres: RCQ médio 0,82 (risco moderado)',
              interpretation: 'População brasileira apresenta risco cardiovascular moderado pela distribuição de gordura',
              source: 'Dados baseados na POF 2017-2018'
            },
            keyPoints: [
              'Homens: <0,90 (baixo), 0,90-0,95 (moderado), >0,95 (alto risco)',
              'Mulheres: <0,80 (baixo), 0,80-0,85 (moderado), >0,85 (alto risco)',
              'Gordura abdominal é mais perigosa que periférica',
              'Complementa a avaliação do IMC'
            ],
            commonMistakes: [
              'Medir circunferências em locais incorretos',
              'Não considerar diferenças entre sexos',
              'Usar apenas RCQ sem outros indicadores'
            ]
          }
        ],
        estimatedTime: 4
      },
      {
        id: 'growth-curves',
        title: 'Curvas de Crescimento Infantil',
        icon: <TrendingUp className="w-6 h-6 text-green-600" />,
        content: `As curvas de crescimento são como "mapas do crescimento" que mostram se uma criança está crescendo adequadamente. É como comparar o crescimento da criança com milhares de outras da mesma idade e sexo.`,
        concepts: [
          {
            term: 'Curvas de Crescimento',
            definition: 'Gráficos que mostram como peso, altura e outras medidas variam com a idade, baseados em padrões populacionais',
            whenToUse: 'Para avaliar se o crescimento de uma criança está adequado para sua idade e sexo',
            dailyLifeAnalogy: {
              title: 'Régua de Crescimento na Parede',
              description: 'É como a régua que os pais fazem na parede para marcar a altura dos filhos, mas comparando com todas as crianças do Brasil',
              icon: <Ruler className="w-4 h-4" />,
              connection: 'Assim como a régua mostra se a criança cresceu, as curvas mostram se está crescendo como esperado'
            },
            brazilianExample: {
              title: 'Curvas de Crescimento Brasileiras',
              context: 'Ministério da Saúde adota padrões da OMS adaptados para crianças brasileiras',
              data: 'Baseadas em milhares de crianças saudáveis de 0 a 5 anos',
              interpretation: 'Permitem identificar precocemente problemas de crescimento e nutrição',
              source: `${growthCurvesCitation.authors}. ${growthCurvesCitation.title}. ${growthCurvesCitation.year}.`
            },
            keyPoints: [
              'Percentil 50 (P50) = mediana - metade das crianças está acima, metade abaixo',
              'P3 a P97 = faixa de normalidade para a maioria das crianças',
              'Percentis baixos (<P10) podem indicar desnutrição',
              'Percentis altos (>P85) podem indicar sobrepeso/obesidade'
            ],
            commonMistakes: [
              'Confundir percentil com porcentagem',
              'Preocupar-se com variações normais de crescimento',
              'Não considerar fatores genéticos familiares'
            ]
          }
        ],
        estimatedTime: 5
      }
    ]

    return (
      <AdvancedEducationalContent
        gameId={1}
        gameTitle="Indicadores Antropométricos"
        gameDescription="Aprenda a avaliar o estado nutricional através de medidas corporais como peso, altura, IMC e circunferências usando dados reais da população brasileira"
        sections={educationalSections}
        onStartGame={handleStartGame}
        totalEstimatedTime={18}
      />
    )
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto p-8"
        >
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Parabéns! Jogo Concluído
              </h2>
              
              <p className="text-lg text-gray-600 mb-6">
                Você completou com sucesso o jogo de Indicadores Antropométricos
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{score}</div>
                  <div className="text-sm text-gray-600">Pontuação</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{formatTime(timeElapsed)}</div>
                  <div className="text-sm text-gray-600">Tempo</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{exercises.length}</div>
                  <div className="text-sm text-gray-600">Exercícios</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button onClick={onComplete} size="lg" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Voltar aos Jogos
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCurrentExercise(0)
                    setSelectedAnswer(null)
                    setShowFeedback(false)
                    setScore(0)
                    setTimeElapsed(0)
                    setIsCompleted(false)
                    setShowEducation(true)
                  }}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Jogar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const currentEx = exercises[currentExercise]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar aos Jogos
            </Button>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {formatTime(timeElapsed)}
              </div>
              <div className="flex items-center">
                <Target className="w-4 h-4 mr-1" />
                {score}/100
              </div>
              <div className="flex items-center">
                <BookOpen className="w-4 h-4 mr-1" />
                {currentExercise + 1}/{exercises.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={currentExercise}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Scale className="w-8 h-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{currentEx.title}</h1>
                    <p className="text-gray-600">{currentEx.description}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentEx.difficulty)}`}>
                  {currentEx.difficulty.replace('-', ' ')}
                </span>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Cenário Real - Dados Brasileiros
                </h3>
                <p className="text-blue-800">{currentEx.scenario}</p>
                {currentEx.calculation && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <div className="font-mono text-sm text-gray-700">{currentEx.calculation}</div>
                  </div>
                )}

                {/* Growth curve visualization for exercises 6, 7, 8 */}
                {(currentEx.id === 6 || currentEx.id === 7 || currentEx.id === 8) && currentEx.realData && (
                  <div className="mt-4">
                    <GrowthCurveChart
                      type={currentEx.id === 7 ? 'height' : 'weight'}
                      gender={currentEx.realData.gender}
                      childData={currentEx.realData}
                      showPercentiles={[3, 10, 25, 50, 75, 90, 97]}
                      title={`Curva ${currentEx.id === 7 ? 'Altura' : 'Peso'}-por-Idade - ${currentEx.realData.name}`}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{currentEx.question}</h3>
                  
                  <div className="space-y-3">
                    {currentEx.options.map((option, index) => (
                      <motion.button
                        key={index}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAnswerSelect(index)}
                        disabled={showFeedback}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                          selectedAnswer === index
                            ? showFeedback
                              ? index === currentEx.correctAnswer
                                ? 'border-green-500 bg-green-50'
                                : 'border-red-500 bg-red-50'
                              : 'border-blue-500 bg-blue-50'
                            : showFeedback && index === currentEx.correctAnswer
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center mr-3 text-sm font-medium">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span>{option}</span>
                          {showFeedback && selectedAnswer === index && (
                            <span className="ml-auto">
                              {index === currentEx.correctAnswer ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-600" />
                              )}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {showFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gray-50 p-6 rounded-lg"
                  >
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Info className="w-5 h-5 mr-2 text-blue-600" />
                      Explicação
                    </h4>
                    <p className="text-gray-700 leading-relaxed">{currentEx.explanation}</p>
                    
                    <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                      <div className="text-sm text-blue-800">
                        <strong>Objetivo de Aprendizado:</strong> {currentEx.learningObjective}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setShowEducation(true)}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Revisar Conteúdo
                  </Button>
                  
                  {!showFeedback ? (
                    <Button
                      onClick={handleAnswerSubmit}
                      disabled={selectedAnswer === null}
                    >
                      Confirmar Resposta
                    </Button>
                  ) : (
                    <Button onClick={handleNextExercise}>
                      {currentExercise < exercises.length - 1 ? 'Próximo Exercício' : 'Iniciar Exercícios Interativos'}
                    </Button>
                  )}
                </div>

                {/* Add percentile reference for growth curve exercises */}
                {(currentExercise >= 5) && (
                  <div className="mt-6">
                    <PercentileReference />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )

  // Interactive Exercises Section
  if (showInteractiveExercises && !isCompleted) {
    const currentInteractiveEx = interactiveExercises[currentInteractiveExercise]

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="text-emerald-700 border-emerald-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-emerald-900">
                    Jogo 1: Indicadores Antropométricos - Exercícios Interativos
                  </h1>
                  <p className="text-emerald-700">
                    Exercício {currentInteractiveExercise + 1} de {interactiveExercises.length} - {currentInteractiveEx.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className="text-sm text-emerald-600">Pontuação Total</div>
                  <div className="text-xl font-bold text-emerald-900">
                    {score + interactiveScore}/{maxScore}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-emerald-600">Tempo</div>
                  <div className="text-xl font-bold text-emerald-900 flex items-center">
                    <Clock className="w-5 h-5 mr-1" />
                    {formatTime(timeElapsed)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Exercise Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <InteractiveGrowthCurveChart
            exerciseId={currentInteractiveEx.id}
            chartType={currentInteractiveEx.chartType}
            gender={currentInteractiveEx.gender}
            targetChild={currentInteractiveEx.targetChild}
            interactionType={currentInteractiveEx.type}
            onComplete={handleInteractiveExerciseComplete}
            maxAttempts={currentInteractiveEx.maxAttempts}
            targetPercentile={currentInteractiveEx.targetPercentile}
          />
        </div>
      </div>
    )
  }
}
