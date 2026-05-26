import { useState, useMemo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs" 
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import jsPDF from 'jspdf'
import { toJpeg } from 'html-to-image'

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
  
  const [redesignedImage, setRedesignedImage] = useState<string | null>(null)
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false)

  const [customRates, setCustomRates] = useState<Record<string, number>>({
    "Paint": 15, "Stone cladding": 45, "Tiles": 30, "Texture finish": 20,
    "Glass railing": 60, "Metal railing": 40, "Panels": 35
  })

  const wsRef = useRef<WebSocket | null>(null)

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1024 
          const MAX_HEIGHT = 1024
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.onerror = () => reject(new Error("Failed to load image for compression"))
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
    })
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (selectedImage) URL.revokeObjectURL(selectedImage)
    if (wsRef.current) wsRef.current.close()

    const objectUrl = URL.createObjectURL(file)
    setSelectedImage(objectUrl)
    
    setIsAnalyzing(true)
    setValidationError(null)
    setDetectedRegions([])
    setActiveRegion(null)
    setMaterialMapping({})
    setRedesignedImage(null) 
    setLiveLogs(["> INITIALIZING LIVE STREAM...", "> Compressing image for fast upload..."])

    try {
      const compressedBase64 = await compressImage(file)
      
      const ws = new WebSocket("ws://localhost:8000/ws/analyze")
      wsRef.current = ws

      ws.onopen = () => {
        setLiveLogs(prev => [...prev, "> Connection established. Transmitting optimized data..."])
        ws.send(JSON.stringify({ image: compressedBase64 }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === "log") {
          setLiveLogs(prev => [...prev, `> ${data.message}`])
        } 
        else if (data.type === "success") {
          setDetectedRegions(data.estimations.regions)
          if (data.estimations.regions.length > 0) setActiveRegion(data.estimations.regions[0].name)
          setIsAnalyzing(false)
          ws.close()
        } 
        else if (data.type === "error") {
          setValidationError(data.message)
          setIsAnalyzing(false)
          ws.close()
        }
      }

      ws.onerror = () => {
        setValidationError("WebSocket connection failed. Ensure your Python backend is running.")
        setIsAnalyzing(false)
      }

      ws.onclose = () => {
        if (isAnalyzing) {
           setIsAnalyzing(false)
        }
      }

    } catch (error: any) {
      console.error(error);
      setValidationError("Failed to process the image file.")
      setIsAnalyzing(false)
    } finally {
      event.target.value = '' 
    }
  }

  const handleGenerateVisualization = async () => {
    if (!selectedImage || Object.keys(materialMapping).length === 0) {
      setValidationError("Please map at least one material before generating a redesign.")
      return
    }

    setIsGeneratingVisual(true)
    setValidationError(null)
    
    try {
      const response = await fetch(selectedImage)
      const blob = await response.blob()
      const file = new File([blob], "upload.jpg", { type: "image/jpeg" })
      const compressedBase64 = await compressImage(file)

      const formData = new FormData()
      formData.append("image", compressedBase64)
      formData.append("materials", JSON.stringify(materialMapping))

      const res = await fetch("http://localhost:8000/api/visualize", {
        method: "POST",
        body: formData
      })

      if (!res.ok) throw new Error("Failed to generate visualization")
      
      const data = await res.json()
      setRedesignedImage(data.redesigned_image)
      document.getElementById('tab-redesign')?.click()

    } catch (error: any) {
      setValidationError(error.message)
    } finally {
      setIsGeneratingVisual(false)
    }
  }

  const generatePDFReport = async () => {
    const reportElement = document.getElementById('report-container')
    const scrollContainer = document.getElementById('cost-breakdown-scroll')
    if (!reportElement) return

    const downloadBtn = document.getElementById('download-btn')
    if (downloadBtn) downloadBtn.style.display = 'none'

    let originalClasses = "";
    if (scrollContainer) {
      originalClasses = scrollContainer.className;
      scrollContainer.className = "space-y-4"; 
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 50)); 

      const elWidth = reportElement.offsetWidth
      const elHeight = reportElement.offsetHeight

      const imgData = await toJpeg(reportElement, { 
        quality: 0.8, 
        pixelRatio: 2, 
        backgroundColor: '#f8fafc' 
      })
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (elHeight * pdfWidth) / elWidth

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save('Propsense_Renovation_Estimate.pdf')
      
    } catch (error) {
      console.error("Failed to generate PDF", error)
      setValidationError("Failed to generate the PDF report. Please try again.")
    } finally {
      if (downloadBtn) downloadBtn.style.display = 'flex'
      if (scrollContainer) scrollContainer.className = originalClasses; 
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
    if (selectedImage) URL.revokeObjectURL(selectedImage)
    if (wsRef.current) wsRef.current.close()
    
    setSelectedImage(null)
    setDetectedRegions([])
    setValidationError(null)
    setActiveRegion(null)
    setMaterialMapping({})
    setLiveLogs([])
    setRedesignedImage(null)
    setIsAnalyzing(false)
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

        <div id="report-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 bg-slate-50 rounded-xl p-2 sm:p-4">
          
          <div className="col-span-1 lg:col-span-7 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-4">
                <Tabs defaultValue="original" className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-xl">Exterior Visualization</CardTitle>
                    <TabsList className="bg-slate-100 self-start sm:self-auto">
                      <TabsTrigger value="original">Original</TabsTrigger>
                      <TabsTrigger id="tab-redesign" value="redesign" disabled={!redesignedImage}>Redesign</TabsTrigger>
                    </TabsList>
                  </div>

                  <CardContent className="px-0 pt-6 pb-0">
                    {selectedImage ? (
                      <>
                        <TabsContent value="original" className="mt-0">
                          <div className="space-y-4">
                            <div className="relative w-full h-[350px] sm:h-[450px] bg-slate-900 rounded-lg overflow-hidden border border-slate-200 group flex items-center justify-center">
                              <img src={selectedImage} alt="Uploaded property" className="w-full h-full object-contain" />
                              
                              {isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center p-8 w-full h-full bg-slate-900/40">
                                  <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                              )}

                              <Button variant="destructive" size="icon" className="absolute top-4 right-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onClick={removeImage} disabled={isAnalyzing}>
                                X
                              </Button>
                            </div>

                            {isAnalyzing && liveLogs.length > 0 && (
                              <div className="w-full bg-black/80 rounded-md p-4 border border-slate-700 font-mono text-xs text-emerald-400 h-32 overflow-y-auto flex flex-col gap-1 text-left animate-in fade-in-0 slide-in-from-bottom-5">
                                {liveLogs.map((log, idx) => (
                                  <span key={idx} className="animate-pulse">{log}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="redesign" className="mt-0">
                          <div className="relative w-full h-[350px] sm:h-[450px] bg-slate-900 rounded-lg overflow-hidden border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center">
                            {redesignedImage && <img src={redesignedImage} alt="AI Redesign" className="w-full h-full object-contain" />}
                            <div className="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                              AI Redesign Generated
                            </div>
                          </div>
                        </TabsContent>
                      </>
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
                </Tabs>
              </CardHeader>
            </Card>
          </div>

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
                  <div className="space-y-6 flex flex-col">
                    
                    <div id="cost-breakdown-scroll" className="max-h-[300px] overflow-y-auto pr-2 space-y-4">
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
                    </div>

                    <div className="flex items-center justify-between pt-4 text-xl font-bold text-slate-900 border-t-2 border-slate-200 mt-auto">
                      <span>Grand Total</span>
                      <span>₹{estimateData.grandTotal.toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                    </div>

                    <Button 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-sm mt-4" 
                      disabled={isAnalyzing || isGeneratingVisual}
                      onClick={handleGenerateVisualization}
                    >
                      {isGeneratingVisual ? "Rendering AI Redesign..." : "Generate Visualization"}
                    </Button>
                    
                    <Button 
                      id="download-btn"
                      variant="secondary" 
                      className="w-full flex items-center justify-center gap-2" 
                      disabled={isAnalyzing || estimateData.lineItems.length === 0}
                      onClick={generatePDFReport}
                    >
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