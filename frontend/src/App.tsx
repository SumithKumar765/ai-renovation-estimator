import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Region = { name: string; area_sqft: number }

const MATERIAL_CATALOG = [
  "Paint", "Stone cladding", "Tiles", "Texture finish", 
  "Glass railing", "Metal railing", "Panels"
]

const MATERIAL_METRICS: Record<string, { coverage: number, unit: string, wastage: number, laborMultiplier: number }> = {
  "Paint": { coverage: 100, unit: "Liters", wastage: 0.10, laborMultiplier: 0.5 },
  "Stone cladding": { coverage: 1, unit: "Sq.Ft", wastage: 0.15, laborMultiplier: 2.0 },
  "Tiles": { coverage: 1, unit: "Boxes (10 sqft)", wastage: 0.10, laborMultiplier: 1.5 },
  "Texture finish": { coverage: 50, unit: "Liters", wastage: 0.10, laborMultiplier: 0.8 },
  "Glass railing": { coverage: 1, unit: "Linear Ft", wastage: 0.05, laborMultiplier: 1.2 },
  "Metal railing": { coverage: 1, unit: "Linear Ft", wastage: 0.05, laborMultiplier: 1.0 },
  "Panels": { coverage: 1, unit: "Panels (8 sqft)", wastage: 0.10, laborMultiplier: 1.0 }
}

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [liveLogs, setLiveLogs] = useState<string[]>([])
  
  const [detectedRegions, setDetectedRegions] = useState<Region[]>([])
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [materialMapping, setMaterialMapping] = useState<Record<string, string>>({})
  
  const [customRates, setCustomRates] = useState<Record<string, number>>({
    "Paint": 15, "Stone cladding": 45, "Tiles": 30, "Texture finish": 20,
    "Glass railing": 60, "Metal railing": 40, "Panels": 35
  })

  // Convert file to base64 for websocket transmission
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedImage(URL.createObjectURL(file))
    setIsAnalyzing(true)
    setValidationError(null)
    setDetectedRegions([])
    setActiveRegion(null)
    setMaterialMapping({})
    // Initialize logs with terminal-style start
    setLiveLogs(["> INITIALIZING LIVE STREAM..."])

    try {
      const base64Image = await fileToBase64(file)
      
      // Open WebSocket connection
      const ws = new WebSocket("ws://localhost:8000/ws/analyze")

      ws.onopen = () => {
        setLiveLogs(prev => [...prev, "Connection established. Transmitting image data..."])
        ws.send(JSON.stringify({ image: base64Image }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === "log") {
          // Push new log to the stream
          setLiveLogs(prev => [...prev, data.message])
        } 
        else if (data.type === "success") {
          // Set final results
          setDetectedRegions(data.estimations.regions)
          if (data.estimations.regions.length > 0) setActiveRegion(data.estimations.regions[0].name)
          setIsAnalyzing(false)
          ws.close()
        } 
        else if (data.type === "error") {
          setValidationError(data.message)
          setSelectedImage(null)
          setIsAnalyzing(false)
          ws.close()
        }
      }

      ws.onerror = () => {
        setValidationError("WebSocket connection failed. AI services are unreachable.")
        setSelectedImage(null)
        setIsAnalyzing(false)
      }

    } catch (error: any) {
      console.error(error);
      setValidationError("Failed to read image file. Try again.")
      setIsAnalyzing(false)
    } finally {
      event.target.value = ''
    }
  }

  const handleMaterialSelect = (material: string) => {
    if (!activeRegion) return
    setMaterialMapping(prev => ({ ...prev, [activeRegion]: material }))
  }

  const handleRateChange = (material: string, newRate: string) => {
    setCustomRates(prev => ({ ...prev, [material]: Number(newRate) }))
  }

  const removeImage = () => {
    setSelectedImage(null)
    setDetectedRegions([])
    setValidationError(null)
    setActiveRegion(null)
    setMaterialMapping({})
    setLiveLogs([])
  }

  const estimateData = useMemo(() => {
    let grandTotal = 0
    const lineItems = Object.entries(materialMapping).map(([regionName, material]) => {
      const region = detectedRegions.find(r => r.name === regionName)
      const area = region ? region.area_sqft : 0
      
      const metrics = MATERIAL_METRICS[material]
      const baseRate = customRates[material] || 0
      
      const rawQuantity = area / metrics.coverage
      const totalQuantity = rawQuantity * (1 + metrics.wastage)
      
      const materialCost = totalQuantity * baseRate
      const laborCost = area * metrics.laborMultiplier
      const totalCost = materialCost + laborCost
      
      grandTotal += totalCost

      return {
        region: regionName, material, area, quantity: totalQuantity.toFixed(1),
        unit: metrics.unit, wastagePct: (metrics.wastage * 100).toFixed(0),
        materialCost, laborCost, totalCost
      }
    })

    return { lineItems, grandTotal }
  }, [materialMapping, detectedRegions, customRates])

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

        {validationError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-sm font-medium text-red-800">{validationError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Column: Visualization */}
          <div className="col-span-1 lg:col-span-7 space-y-6">
            <Card className="shadow-sm border-slate-200">
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
              
              <CardContent>
                {selectedImage ? (
                  /* PRD-Strict: Container to display image and logs separately */
                  <div className="space-y-4">
                    {/* 1. Image View Container (Restored visibility) */}
                    <div className="relative w-full h-[350px] sm:h-[450px] bg-slate-900 rounded-lg overflow-hidden border border-slate-200 group flex items-center justify-center">
                      <img 
                        src={selectedImage} 
                        alt="Uploaded property" 
                        // Removed blur-sm and opacity-50. This is always fully visible.
                        className="w-full h-full object-contain" 
                      />
                      
                      {/* Spinner Overlay (Only spinner, no logs) over image while analyzing */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 flex items-center justify-center p-8 w-full h-full bg-slate-900/40">
                          <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </div>
                      )}

                      <Button variant="destructive" size="icon" className="absolute top-4 right-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onClick={removeImage} disabled={isAnalyzing}>
                        X
                      </Button>
                    </div>

                    {/* 2. Logs View Container (Moved to empty space below image, block element) */}
                    {isAnalyzing && liveLogs.length > 0 && (
                      <div className="w-full bg-black/80 rounded-md p-4 border border-slate-700 font-mono text-xs text-emerald-400 h-32 overflow-y-auto flex flex-col gap-1 text-left animate-in fade-in-0 slide-in-from-bottom-5">
                        {liveLogs.map((log, idx) => (
                          <span key={idx} className="animate-pulse">{`> ${log}`}</span>
                        ))}
                      </div>
                    )}
                  </div>

                ) : (
                  <div className="h-[350px] sm:h-[450px] w-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 p-6 text-center transition-colors hover:border-slate-400">
                    <Label htmlFor="file-upload" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-900 text-slate-50 hover:bg-slate-800 h-10 px-4 py-2 cursor-pointer transition-colors shadow">
                      Select Exterior Image
                      <Input id="file-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                    </Label>
                    <p className="mt-2 text-xs text-slate-400">Supported formats: JPG, PNG, WEBP</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Mapping & Estimation */}
          <div className="col-span-1 lg:col-span-5 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Material Mapping</CardTitle>
                <CardDescription>Assign materials to detected sections.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="font-semibold">1. Select Target Region</Label>
                  <div className="flex flex-wrap gap-2">
                    {detectedRegions.map(region => {
                      const hasMaterial = !!materialMapping[region.name];
                      return (
                        <Button key={region.name} variant={activeRegion === region.name ? "default" : "outline"} size="sm" className={`h-8 text-xs ${hasMaterial && activeRegion !== region.name ? 'border-emerald-200 bg-emerald-50' : ''}`} onClick={() => setActiveRegion(region.name)}>
                          {region.name} ({region.area_sqft} sqft)
                          {hasMaterial && <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500"></span>}
                        </Button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Label className="font-semibold">2. Apply Material</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MATERIAL_CATALOG.map(material => (
                      <Button key={material} variant={activeRegion && materialMapping[activeRegion] === material ? "default" : "outline"} className="text-xs h-9" disabled={!activeRegion || isAnalyzing} onClick={() => handleMaterialSelect(material)}>
                        {material}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Detailed Cost Breakdown</CardTitle>
                <CardDescription>Adjust market rates to recalculate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {estimateData.lineItems.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 text-slate-500 rounded-lg text-sm border border-dashed border-slate-200">
                    Map materials to regions to generate an estimate.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {estimateData.lineItems.map((item, idx) => (
                      <div key={idx} className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="font-semibold text-slate-800">{item.region} <span className="text-slate-400 font-normal">| {item.material}</span></span>
                          <span className="font-bold text-emerald-600">₹{item.totalCost.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                          <div>
                            <span className="block text-slate-400">Est. Quantity</span>
                            <span className="font-medium text-slate-800">{item.quantity} {item.unit}</span>
                            <span className="block text-[10px]">Inc. {item.wastagePct}% wastage</span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Rate / Unit (₹)</span>
                            <Input 
                              type="number" 
                              value={customRates[item.material]} 
                              onChange={(e) => handleRateChange(item.material, e.target.value)}
                              className="h-6 w-20 text-xs mt-1"
                            />
                          </div>
                          <div>
                            <span className="block text-slate-400">Material Cost</span>
                            <span className="font-medium text-slate-800">₹{item.materialCost.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400">Labor Cost</span>
                            <span className="font-medium text-slate-800">₹{item.laborCost.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-4 text-xl font-bold text-slate-900 border-t-2 border-slate-200">
                      <span>Grand Total</span>
                      <span>₹{estimateData.grandTotal.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                    </div>

                    <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-sm" disabled={isAnalyzing}>
                      Generate Visualization
                    </Button>
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2" disabled={isAnalyzing}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      Download Discussion Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}