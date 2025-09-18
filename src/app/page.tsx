"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Trash2, Plus, Sparkles, CalendarClock, Bell, FolderPlus } from "lucide-react"

// Types
type Priority = "low" | "medium" | "high" | "critical"
type Category = "study" | "work" | "personal" | "feature" | "bug" | "other"

type Task = {
  id: string
  title: string
  description?: string
  category: Category
  priority: Priority
  dueDate?: string | null // ISO
  done: boolean
  createdAt: string // ISO
}

type Project = {
  id: string
  name: string
  createdAt: string
  tasks: Task[]
}

const STORAGE_KEY = "stm-data-v1"

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

// Simple heuristics for AI-like suggestions
function suggestCategory(input: string): Category {
  const s = input.toLowerCase()
  if (/exam|assignment|lecture|study|college|notes|semester/.test(s)) return "study"
  if (/code|deploy|meeting|client|office|work|review|design/.test(s)) return "work"
  if (/gym|shopping|family|clean|health|personal|birthday/.test(s)) return "personal"
  if (/bug|fix|issue|error|defect/.test(s)) return "bug"
  if (/feature|enhancement|add|improve/.test(s)) return "feature"
  return "other"
}

function daysUntil(dateIso?: string | null) {
  if (!dateIso) return Infinity
  const now = new Date()
  const due = new Date(dateIso)
  const diff = due.getTime() - now.getTime()
  return diff / (1000 * 60 * 60 * 24)
}

function suggestPriority(input: string, dueDate?: string | null): Priority {
  const s = input.toLowerCase()
  const d = daysUntil(dueDate)
  if (/urgent|asap|now|immediately|critical/.test(s)) return "critical"
  if (d <= 0) return "critical"
  if (d <= 1) return "high"
  if (/soon|important|priority|review/.test(s)) return "high"
  if (d <= 3) return "medium"
  return "low"
}

export default function Home() {
  // State
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  // New project state
  const [newProjectName, setNewProjectName] = useState("")
  const projectInputRef = useRef<HTMLInputElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  // New task state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<Category | undefined>()
  const [priority, setPriority] = useState<Priority | undefined>()
  const [dueDate, setDueDate] = useState<string>("")

  const notified = useRef<Set<string>>(new Set())

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: { projects: Project[]; selectedProjectId?: string } = JSON.parse(raw)
        setProjects(parsed.projects || [])
        setSelectedProjectId(parsed.selectedProjectId || parsed.projects?.[0]?.id || "")
      } else {
        // seed data
        const demo: Project = {
          id: uid("proj"),
          name: "Placement Prep",
          createdAt: new Date().toISOString(),
          tasks: [
            {
              id: uid("task"),
              title: "Revise DSA patterns",
              description: "Arrays, DP, Graphs. 50 problems",
              category: "study",
              priority: "high",
              dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
              done: false,
              createdAt: new Date().toISOString(),
            },
            {
              id: uid("task"),
              title: "Update resume and projects",
              description: "Add Smart Task Manager with tests",
              category: "personal",
              priority: "medium",
              dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }
        setProjects([demo])
        setSelectedProjectId(demo.id)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Persist
  useEffect(() => {
    try {
      const data = JSON.stringify({ projects, selectedProjectId })
      localStorage.setItem(STORAGE_KEY, data)
    } catch {}
  }, [projects, selectedProjectId])

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId])

  const progressPct = useMemo(() => {
    const total = selectedProject?.tasks.length || 0
    const done = selectedProject?.tasks.filter(t => t.done).length || 0
    if (total === 0) return 0
    return Math.round((done / total) * 100)
  }, [selectedProject])

  // Notifications for due/overdue tasks
  useEffect(() => {
    const interval = setInterval(() => {
      const proj = projects.find(p => p.id === selectedProjectId)
      if (!proj) return
      proj.tasks.forEach(t => {
        if (!t.dueDate || t.done) return
        const d = daysUntil(t.dueDate)
        const key = `${proj.id}:${t.id}`
        if (d < 0 && !notified.current.has(key)) {
          notified.current.add(key)
          toast.error(`Overdue: ${t.title}`, {
            description: "This task is past due. Consider reprioritizing.",
            icon: <Bell className="size-4" />,
          })
        } else if (d <= 1 && !notified.current.has(key)) {
          notified.current.add(key)
          toast("Due soon", {
            description: `${t.title} is due within 24 hours`,
            icon: <CalendarClock className="size-4" />,
          })
        }
      })
    }, 30000) // 30s
    return () => clearInterval(interval)
  }, [projects, selectedProjectId])

  // Actions
  function addProject() {
    const name = newProjectName.trim()
    if (!name) {
      toast.warning("Project name is required")
      return
    }
    const proj: Project = { id: uid("proj"), name, createdAt: new Date().toISOString(), tasks: [] }
    setProjects(prev => [proj, ...prev])
    setSelectedProjectId(proj.id)
    setNewProjectName("")
    toast.success("Project created", { description: name })
  }

  function removeProject(id: string) {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id)
      // If we removed the selected project, select the first remaining one (if any)
      setSelectedProjectId((curr) => (curr === id ? next[0]?.id || "" : curr))
      return next
    })
  }

  function addTask() {
    if (!selectedProject) return
    const tTitle = title.trim()
    if (!tTitle) {
      toast.warning("Task title is required")
      return
    }

    const autoCat = category || suggestCategory(`${tTitle} ${description}`)
    const autoPri = priority || suggestPriority(`${tTitle} ${description}`, dueDate || undefined)

    const task: Task = {
      id: uid("task"),
      title: tTitle,
      description: description.trim() || undefined,
      category: autoCat,
      priority: autoPri,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      done: false,
      createdAt: new Date().toISOString(),
    }

    setProjects(prev => prev.map(p => (p.id === selectedProject.id ? { ...p, tasks: [task, ...p.tasks] } : p)))

    setTitle("")
    setDescription("")
    setCategory(undefined)
    setPriority(undefined)
    setDueDate("")

    toast.success("Task added", { description: `${task.title} • ${task.priority.toUpperCase()} • ${task.category}` })
  }

  function toggleTask(taskId: string) {
    if (!selectedProject) return
    setProjects(prev =>
      prev.map(p =>
        p.id === selectedProject.id
          ? { ...p, tasks: p.tasks.map(t => (t.id === taskId ? { ...t, done: !t.done } : t)) }
          : p
      )
    )
  }

  function removeTask(taskId: string) {
    if (!selectedProject) return
    setProjects(prev => prev.map(p => (p.id === selectedProject.id ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p)))
  }

  // AI Suggest action
  function applySuggestions() {
    const s = `${title} ${description}`
    if (!title.trim() && !description.trim()) {
      toast("Nothing to analyze", { description: "Please type a title or description." })
      return
    }
    const cat = suggestCategory(s)
    const pri = suggestPriority(s, dueDate || undefined)
    setCategory(cat)
    setPriority(pri)
    toast("Suggestions applied", { description: `Category → ${cat}, Priority → ${pri}` })
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[280px_1fr]">
      {/* Sidebar */}
      <aside className="border-r bg-secondary/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="New project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            ref={projectInputRef}
          />
          <Button onClick={addProject} title="Add Project">
            <FolderPlus className="size-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Projects</div>
          <div className="flex flex-col gap-2">
            {projects.length === 0 && (
              <div className="text-sm text-muted-foreground">No projects yet</div>
            )}
            {projects.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors ${p.id === selectedProjectId ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                onClick={() => setSelectedProjectId(p.id)}
              >
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{p.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {p.tasks.filter(t => t.done).length}/{p.tasks.length} done
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Progress value={p.tasks.length ? (p.tasks.filter(t => t.done).length / p.tasks.length) * 100 : 0} />
                </CardContent>
                <CardFooter className="px-4 pt-0 justify-between">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedProjectId(p.id) }}>Open</Button>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeProject(p.id) }}>
                    <Trash2 className="size-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border p-6 bg-gradient-to-br from-chart-2/15 via-accent/40 to-chart-5/15">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/60 backdrop-blur px-3 py-1 text-xs border">
                <Sparkles className="size-3.5 text-primary" /> Smart Task Management with AI
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
                Plan smarter, ship faster
                <span className="block bg-gradient-to-r from-primary to-chart-1 bg-clip-text text-transparent">
                  with intelligent priorities
                </span>
              </h2>
              <p className="text-sm text-muted-foreground max-w-prose mx-auto md:mx-0">
                Human‑crafted UI, AI‑assisted workflow. Auto‑categorize tasks, predict priorities, and stay on track with real‑time progress.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  projectInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                  projectInputRef.current?.focus()
                }}
              >
                <FolderPlus className="size-4" /> Create Project
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  titleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                  titleInputRef.current?.focus()
                }}
              >
                <Plus className="size-4" /> Add Task
              </Button>
            </div>
          </div>
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-20 -right-10 h-56 w-56 rounded-full bg-chart-2/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-chart-5/25 blur-3xl" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {selectedProject ? selectedProject.name : "Create your first project"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Smart Task Management System with AI-assisted priorities and categories
            </p>
          </div>
          <div className="w-48">
            <Progress value={progressPct} />
            <div className="text-right text-xs text-muted-foreground mt-1">{clamp(progressPct)}%</div>
          </div>
        </div>

        {/* Task Creator */}
        <Card>
          <CardHeader>
            <CardTitle>Add Task</CardTitle>
            <CardDescription>AI will suggest a category and priority</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} ref={titleInputRef} />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="[color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="grid md:grid-cols-3 gap-3 items-center">
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Common</SelectLabel>
                    <SelectItem value="study">Study</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Levels</SelectLabel>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={applySuggestions}>
                  <Sparkles className="size-4" /> Suggest
                </Button>
                <Button type="button" onClick={addTask}>
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            </div>

            {/* Live suggestions */}
            {(title || description) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Suggested:</span>
                <Badge variant="secondary">Category: {suggestCategory(`${title} ${description}`)}</Badge>
                <Badge>Priority: {suggestPriority(`${title} ${description}`, dueDate || undefined)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Task List */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Tasks</h2>
          {!selectedProject && (
            <div className="text-sm text-muted-foreground">No project selected. Create one to begin.</div>
          )}
          {selectedProject && selectedProject.tasks.length === 0 && (
            <div className="text-sm text-muted-foreground">No tasks yet. Add your first task above.</div>
          )}

          <div className="grid gap-3">
            {selectedProject?.tasks.map((t) => {
              const dLeft = daysUntil(t.dueDate)
              return (
                <Card key={t.id} className={t.done ? "opacity-70" : ""}>
                  <CardHeader className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t.id)} />
                          <span className={t.done ? "line-through" : undefined}>{t.title}</span>
                        </CardTitle>
                        {t.description && (
                          <CardDescription className={t.done ? "line-through" : undefined}>{t.description}</CardDescription>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Badge variant="secondary">{t.category}</Badge>
                          <Badge className={
                            t.priority === "critical"
                              ? "bg-destructive text-white"
                              : t.priority === "high"
                              ? "bg-primary text-primary-foreground"
                              : ""
                          }>
                            {t.priority}
                          </Badge>
                          {t.dueDate && (
                            <Badge variant={dLeft < 0 ? "destructive" as any : "secondary"}>
                              Due {new Date(t.dueDate).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => removeTask(t.id)} title="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}