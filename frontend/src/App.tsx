import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  // PRD 5.2: Exterior Structure Identification State
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [detectedRegions, setDetectedRegions] = useState<string[]>([])
  
  // PRD 5.7: Adjustable Material Rates (Defaulting to a baseline number)
  const [customRate, setCustomRate] = useState<number>(120) 

  // Image Upload Handler with AI Analysis Simulation
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const imageUrl = URL.createObjectURL(file)
      setSelectedImage(imageUrl)
      
      // Simulate identifying major structural components
      setIsAnalyzing(true)
      setTimeout(() => {
        setIsAnalyzing(false)
        setDetectedRegions(["Main Walls", "Windows", "Balconies", "Roof Edges", "Pillars/Columns"])
      }, 2000)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setDetectedRegions([])
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            Propsense AI Estimator
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl">
            Upload property exteriors to generate redesigned visual options and calculate a transparent renovation cost.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Column: Image Area & AI Structural Mapping */}
          <div className="col-span-1 lg:col-span-8 space-y-6">
            <Card className="shadow-sm border-slate-200 flex flex-col">
              <CardHeader className="pb-4">
                <Tabs defaultValue="original" className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-xl">Exterior Visualization</CardTitle>
                    <TabsList className="bg-slate-100 self-start sm:self-auto">
                      <TabsTrigger value="original">Original</TabsTrigger>
                      <TabsTrigger value="redesign" disabled={!selectedImage || isAnalyzing}>Redesign</TabsTrigger>
                    </TabsList>
                  </div>
                </Tabs>
              </CardHeader>
              
              <CardContent className="flex-grow flex flex-col">
                {selectedImage ? (
                  <div className="relative w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-slate-900 rounded-lg overflow-hidden border border-slate-200 group flex items-center justify-center">
                    <img 
                      src={selectedImage} 
                      alt="Uploaded property" 
                      className={`w-full h-full object-contain transition-opacity duration-500 ${isAnalyzing ? 'opacity-50 blur-sm' : 'opacity-100'}`} 
                    />
                    
                    {/* PRD 5.2: Scanning Overlay */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <svg className="animate-spin h-10 w-10 mb-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium tracking-wider">MAPPING SURFACES...</span>
                      </div>
                    )}

                    <Button 
                      variant="destructive" size="icon"
                      className="absolute top-4 right-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                      onClick={removeImage}
                      disabled={isAnalyzing}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ) : (
                  <div className="h-[400px] sm:h-[500px] lg:h-[600px] w-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 p-6 text-center transition-colors">
                    <svg className="mx-auto h-12 w-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <div className="space-y-2 w-full max-w-xs">
                      <Label htmlFor="file-upload" className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-900 text-slate-50 hover:bg-slate-800 h-10 px-4 py-2 cursor-pointer transition-colors">
                        Select Exterior Image
                        <Input id="file-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                      </Label>
                      <p className="text-sm text-slate-500">or drag and drop</p>
                    </div>
                  </div>
                )}
              </CardContent>
              
              {/* PRD 5.2: Review Detected Regions */}
              {detectedRegions.length > 0 && (
                <CardFooter className="bg-slate-50 border-t border-slate-200 p-4 rounded-b-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-slate-700 mr-2 self-center">Detected Regions:</span>
                    {detectedRegions.map(region => (
                      <span key={region} className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md font-medium">
                        {region}
                      </span>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 text-xs">Adjust Regions</Button>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Right Column: Complete PRD Controls & Estimation */}
          <div className="col-span-1 lg:col-span-4 space-y-6">
            
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Material Catalog</CardTitle>
                <CardDescription>Select finishes for the exterior.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PRD 5.3: Exact Material List */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Paint</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Stone Cladding</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Tiles</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Texture Finish</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Glass Railing</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9">Metal Railing</Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-9 col-span-2">Panels</Button>
                </div>
                
                <Button 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white mt-4 shadow-sm" 
                  disabled={!selectedImage || isAnalyzing}
                >
                  Generate Visualization
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Estimation Breakdown</CardTitle>
                <CardDescription>Adjust rates to view recalculated costs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  
                  {/* PRD 5.7: Modify Material Rates */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <Label className="text-slate-600">Material Rate (/sq.ft)</Label>
                      <Input 
                        type="number" 
                        value={customRate} 
                        onChange={(e) => setCustomRate(Number(e.target.value))}
                        className="h-8 w-24 text-sm"
                      />
                    </div>
                    {/* Formula: Custom Rate * Simulated Area (500 sqft) */}
                    <span className="font-medium self-end py-1">${(customRate * 500).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-slate-600">Labor Cost (Est. 40%)</span>
                    <span className="font-medium">${((customRate * 500) * 0.4).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 text-xl font-bold text-slate-900">
                    <span>Grand Total</span>
                    <span>${((customRate * 500) + ((customRate * 500) * 0.4)).toLocaleString()}</span>
                  </div>

                  {/* PRD 5.8: Report Generation */}
                  <Button 
                    variant="secondary" 
                    className="w-full mt-4 flex items-center justify-center gap-2"
                    disabled={!selectedImage || isAnalyzing}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download Discussion Report
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}