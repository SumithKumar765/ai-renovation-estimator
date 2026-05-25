import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function App() {
  const [hasImage, setHasImage] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">AI Renovation Estimator</h1>
          <p className="text-slate-500">Upload your house exterior to generate designs and cost estimates.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Image Area */}
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200">
            <CardHeader>
              <Tabs defaultValue="original" className="w-full">
                <div className="flex items-center justify-between">
                  <CardTitle>Visualization</CardTitle>
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="redesign" disabled={!hasImage}>Redesign</TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 transition-colors hover:bg-slate-100">
                {/* Drag-and-drop zone placeholder */}
                <div className="text-center space-y-4">
                  <div className="text-slate-400">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-transparent font-medium text-emerald-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500 hover:text-emerald-500">
                      <span>Upload a file</span>
                      <Input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={() => setHasImage(true)} />
                    </Label>
                    <p className="text-sm text-slate-500">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-500">PNG, JPG, up to 20MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Controls & Cost */}
          <div className="space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Material Selection</CardTitle>
                <CardDescription>Choose finishes for the exterior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full justify-start">Paint</Button>
                  <Button variant="outline" className="w-full justify-start">Stone Cladding</Button>
                  <Button variant="outline" className="w-full justify-start">Tiles</Button>
                  <Button variant="outline" className="w-full justify-start">Texture Finish</Button>
                </div>
                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white mt-4" disabled={!hasImage}>
                  Generate Redesign
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Estimated Cost</CardTitle>
                <CardDescription>Based on AI area analysis.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Material</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Labor</span>
                  <span className="font-medium">--</span>
                </div>
                <div className="flex items-center justify-between py-4 text-lg font-bold text-emerald-700">
                  <span>Total</span>
                  <span>$0.00</span>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}