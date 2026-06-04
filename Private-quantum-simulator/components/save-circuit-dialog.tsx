import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"

interface SaveCircuitDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (title: string) => void
  defaultTitle?: string
  mode?: "save" | "update" | "saveAs"
  circuitTitle?: string
  existingTitles?: string[]
  onUpdate?: () => void
}

export function SaveCircuitDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultTitle = "", 
  mode = "save",
  circuitTitle = "",
  existingTitles = [],
  onUpdate
}: SaveCircuitDialogProps) {
  const [title, setTitle] = useState(defaultTitle || circuitTitle)
  const [error, setError] = useState("")

  // Update title when dialog opens or props change
  useEffect(() => {
    setTitle(defaultTitle || circuitTitle)
    setError("")
  }, [defaultTitle, circuitTitle, isOpen])

  const handleSave = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError("Please enter a circuit title")
      return
    }

    // Different logic based on mode
    if (mode === "save") {
      // For new circuits, prevent duplicates
      const isDuplicate = existingTitles.some(
        existingTitle => existingTitle.toLowerCase() === trimmedTitle.toLowerCase()
      )
      
      if (isDuplicate) {
        setError(`A circuit named "${trimmedTitle}" already exists. Please choose a different name or click "Update Existing" to modify the existing circuit.`)
        return
      }
    }
    
    // For "saveAs" and "update" modes, allow saving (no duplicate check needed)
    // Clear error and proceed
    setError("")
    onSave(trimmedTitle)
    if (mode === "save" || mode === "saveAs") {
      setTitle("")
    }
    onClose()
  }

  const handleUpdate = () => {
    if (onUpdate) {
      setError("") // Clear any errors
      onUpdate()
      onClose()
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    
    // Clear existing error first
    setError("")
    
    // Check for duplicates in real-time (only for save mode, not saveAs)
    if (mode === "save" && newTitle.trim()) {
      const isDuplicate = existingTitles.some(
        existingTitle => existingTitle.toLowerCase() === newTitle.trim().toLowerCase()
      )
      
      if (isDuplicate) {
        setError(`A circuit named "${newTitle.trim()}" already exists. Choose a different name or click "Update Existing".`)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // If there's a duplicate and we're in save mode, don't proceed with save
      const trimmedTitle = title.trim()
      const isDuplicate = existingTitles.some(
        existingTitle => existingTitle.toLowerCase() === trimmedTitle.toLowerCase()
      )
      
      if (mode === "save" && isDuplicate) {
        // Error is already shown from handleTitleChange, just return
        return
      }
      
      handleSave()
    }
  }

  const dialogTitle = mode === "update" ? "Update Circuit" : 
                    mode === "saveAs" ? "Save As New Circuit" : 
                    "Save Circuit"
  const buttonText = mode === "update" ? "Update Circuit" : 
                    mode === "saveAs" ? "Save As New" : 
                    "Save Circuit"
  const placeholder = mode === "update" ? "Update circuit title..." : 
                     mode === "saveAs" ? "Enter new circuit name..." : 
                     "Enter circuit title..."
  
  const isDuplicateName = existingTitles.some(
    existingTitle => existingTitle.toLowerCase() === title.trim().toLowerCase()
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={handleTitleChange}
              onKeyPress={handleKeyPress}
              className="col-span-3"
              placeholder={placeholder}
              autoFocus
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === "save" && isDuplicateName && onUpdate && (
            <Button type="button" variant="default" onClick={handleUpdate}>
              Update Existing
            </Button>
          )}
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={!title.trim() || (mode === "save" && isDuplicateName)}
          >
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
