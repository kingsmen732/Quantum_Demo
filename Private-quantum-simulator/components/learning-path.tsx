"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Lock, Trophy, Target, Zap } from "lucide-react"

interface LearningProgress {
  circuitBuilder: boolean
  blochSphere: boolean
  completedTutorials: string[]
  achievements: string[]
  currentLevel: number
}

interface Milestone {
  id: string
  name: string
  description: string
}

interface LearningPathProps {
  progress: LearningProgress
  milestones: Milestone[]
  onAchievementUnlock: (achievementId: string) => void
}

const LEARNING_MODULES = [
  {
    id: "basics",
    title: "Quantum Basics",
    description: "Learn fundamental quantum concepts",
    icon: Target,
    color: "text-blue-500",
    requirements: [],
    topics: ["Qubits", "Superposition", "Measurement"],
  },
  {
    id: "circuits",
    title: "Quantum Circuits",
    description: "Build and understand quantum circuits",
    icon: Zap,
    color: "text-green-500",
    requirements: ["basics"],
    topics: ["Quantum Gates", "Circuit Design", "State Evolution"],
  },
  {
    id: "visualization",
    title: "State Visualization",
    description: "Visualize quantum states on the Bloch sphere",
    icon: Target,
    color: "text-purple-500",
    requirements: ["basics"],
    topics: ["Bloch Sphere", "State Representation", "Rotations"],
  },
]

export function LearningPath({ progress, milestones, onAchievementUnlock }: LearningPathProps) {
  const isModuleUnlocked = (moduleId: string) => {
    const module = LEARNING_MODULES.find((m) => m.id === moduleId)
    if (!module) return false

    return module.requirements.every((req) => {
      switch (req) {
        case "basics":
          return true // Always unlocked
        case "circuits":
          return progress.circuitBuilder
        case "visualization":
          return progress.blochSphere
        default:
          return false
      }
    })
  }

  const getModuleProgress = (moduleId: string) => {
    switch (moduleId) {
      case "basics":
        return 100 // Always complete once they start
      case "circuits":
        return progress.circuitBuilder ? 100 : 0
      case "visualization":
        return progress.blochSphere ? 100 : 0
      default:
        return 0
    }
  }

  const overallProgress = (progress.achievements.length / milestones.length) * 100

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Learning Progress</h3>
        <div className="flex items-center justify-center gap-4">
          <Progress value={overallProgress} className="w-48" />
          <span className="text-sm text-muted-foreground">{Math.round(overallProgress)}% Complete</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LEARNING_MODULES.map((module) => {
          const Icon = module.icon
          const isUnlocked = isModuleUnlocked(module.id)
          const moduleProgress = getModuleProgress(module.id)

          return (
            <Card key={module.id} className={`transition-all ${isUnlocked ? "hover:shadow-md" : "opacity-60"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isUnlocked ? "bg-muted" : "bg-muted/50"}`}>
                    {isUnlocked ? (
                      <Icon className={`w-5 h-5 ${module.color}`} />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{module.title}</h4>
                      {moduleProgress === 100 && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">{module.description}</p>

                    <div className="space-y-2">
                      <Progress value={moduleProgress} className="h-2" />
                      <div className="flex flex-wrap gap-1">
                        {module.topics.map((topic) => (
                          <Badge key={topic} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold">Achievements</h4>
        <div className="grid grid-cols-1 gap-2">
          {milestones.map((milestone) => {
            const isUnlocked = progress.achievements.includes(milestone.id)

            return (
              <div
                key={milestone.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isUnlocked ? "bg-green-50 border-green-200" : "bg-muted/50"
                }`}
              >
                {isUnlocked ? (
                  <Trophy className="w-5 h-5 text-blue-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}

                <div className="flex-1">
                  <div className="font-medium">{milestone.name}</div>
                  <div className="text-sm text-muted-foreground">{milestone.description}</div>
                </div>

                {isUnlocked && (
                  <Badge variant="secondary" className="text-xs">
                    Unlocked
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
