import { useState, useEffect, useMemo, useRef } from 'react'
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
  
  // Tab State for auto-switching
  const [activeTab, setActiveTab] = useState<string>("original")

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false)

  const [customRates, setCustomRates] = useState<Record<string, number>>({
    "Paint": 15, "Stone cladding": 45, "Tiles": 30, "Texture finish": 20,
    "Glass railing": 60, "Metal railing": 40, "Panels": 35
  })

  const wsRef = useRef<WebSocket | null>(null)

  // Trigger Tailwind dark mode on the HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

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
    setActiveTab("original")
    setLiveLogs(["> INITIALIZING LIVE STREAM...", "> Compressing image for fast upload..."])

    try {
      const compressedBase64 = await compressImage(file)
      
      const ws = new WebSocket("wss://ai-renovation-estimator-2.onrender.com/ws/analyze")
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
          const firstValid = data.estimations.regions.find((r: Region) => r.area_sqft > 0)
          if (firstValid) setActiveRegion(firstValid.name)
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

      const res = await fetch("https://ai-renovation-estimator-2.onrender.com/api/visualize", {
        method: "POST",
        body: formData
      })

      if (!res.ok) throw new Error("Failed to generate visualization")
      
      const data = await res.json()
      setRedesignedImage(data.redesigned_image)
      
      // Auto-switch to the redesign tab
      setActiveTab("redesign")

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

    // BULLETPROOF SCROLL EXPANSION
    let originalClasses = "";
    if (scrollContainer) {
      originalClasses = scrollContainer.className;
      scrollContainer.classList.remove('max-h-[500px]', 'overflow-y-auto', 'custom-scrollbar');
      scrollContainer.style.height = 'max-content'; // Allow it to expand fully without breaking flex
    }

    // Temporarily force Light Mode for an ink-friendly PDF print
    const wasDark = document.documentElement.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }

    try {
      // Wait for layout to settle and Tailwind fade animation to finish
      await new Promise(resolve => setTimeout(resolve, 400)); 

      const elWidth = reportElement.offsetWidth
      const elHeight = reportElement.scrollHeight // Capture full height

      if (elWidth === 0 || elHeight === 0) {
          throw new Error("UI container lost its dimensions during export.");
      }

      const imgData = await toJpeg(reportElement, { 
        quality: 0.9, 
        pixelRatio: 1.5, // Reduced slightly to prevent strict memory crashes
        backgroundColor: '#f8fafc',
        cacheBust: true,
        style: { fontFamily: 'sans-serif' }
      })
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // --- NEW MARGIN MATH APPLIED ---
      const margin = 15; // 15mm border around the edge
      const pdfWidth = pdf.internal.pageSize.getWidth() - (margin * 2);
      const pdfHeight = (elHeight * pdfWidth) / elWidth;

      pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth, pdfHeight)
      pdf.save('Propsense_Renovation_Estimate.pdf')
      
    } catch (error: any) {
      console.error("Failed to generate PDF", error)
      setValidationError(`PDF Error: ${error.message || "Memory limit exceeded."} Try again.`)
    } finally {
      if (downloadBtn) downloadBtn.style.display = 'flex'
      if (scrollContainer) {
          scrollContainer.className = originalClasses;
          scrollContainer.style.height = ''; 
      }
      
      // Instantly restore Dark Mode if it was active
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
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
    setActiveTab("original")
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-4 sm:p-6 md:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Propsense AI Estimator
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl">
              Upload property exteriors to generate redesigned visual options and calculate a transparent renovation cost.
            </p>
          </div>

          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 self-start sm:self-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </header>

        {validationError && (
          <div className="bg-red-50 dark:bg-red-950/50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{validationError}</p>
            </div>
          </div>
        )}

        <div id="report-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-2 sm:p-4 transition-colors duration-300">
          
          <div className="col-span-1 lg:col-span-7 space-y-6">
            
            {/* Visualization Card */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-300">
              <CardHeader className="pb-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-xl dark:text-white">Exterior Visualization</CardTitle>
                    <TabsList className="bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
                      <TabsTrigger value="original" className="dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-white">Original</TabsTrigger>
                      <TabsTrigger id="tab-redesign" value="redesign" disabled={!redesignedImage} className="dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-white">Redesign</TabsTrigger>
                    </TabsList>
                  </div>

                  <CardContent className="px-0 pt-6 pb-0">
                    {selectedImage ? (
                      <>
                        <TabsContent value="original" className="mt-0">
                          <div className="space-y-4">
                            <div className="relative w-full h-[350px] sm:h-[450px] bg-slate-900 dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 group flex items-center justify-center">
                              <img src={selectedImage} alt="Uploaded property" className="w-full h-full object-contain" />
                              
                              {isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center p-8 w-full h-full bg-slate-900/60">
                                  <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                              )}

                              <Button variant="destructive" size="icon" className="absolute top-4 right-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onClick={removeImage} disabled={isAnalyzing}>
                                X
                              </Button>
                            </div>

                            {isAnalyzing && liveLogs.length > 0 && (
                              <div className="w-full bg-black/80 dark:bg-black/90 rounded-md p-4 border border-slate-700 dark:border-slate-800 font-mono text-xs text-emerald-400 h-32 overflow-y-auto flex flex-col gap-1 text-left animate-in fade-in-0 slide-in-from-bottom-5">
                                {liveLogs.map((log, idx) => (
                                  <span key={idx} className="animate-pulse">{log}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="redesign" className="mt-0">
                          <div className="relative w-full h-[350px] sm:h-[450px] bg-slate-900 dark:bg-slate-950 rounded-lg overflow-hidden border border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center">
                            {redesignedImage && <img src={redesignedImage} alt="AI Redesign" className="w-full h-full object-contain" />}
                            <div className="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                              AI Redesign Generated
                            </div>
                          </div>
                        </TabsContent>
                      </>
                    ) : (
                      <div className="h-[350px] sm:h-[450px] w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 p-6 text-center transition-colors">
                        <Label htmlFor="file-upload" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-900 dark:bg-slate-100 text-slate-50 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 h-10 px-4 py-2 cursor-pointer transition-colors shadow">
                          Select Exterior Image
                          <Input id="file-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                        </Label>
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Supported formats: JPG, PNG, WEBP</p>
                      </div>
                    )}
                  </CardContent>
                </Tabs>
              </CardHeader>
            </Card>

            {/* Material Mapping Card */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-300">
              <CardHeader>
                <CardTitle className="dark:text-white">Material Mapping</CardTitle>
                <CardDescription className="dark:text-slate-400">Assign materials to detected sections.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* 1. Select Target Region */}
                <div className="space-y-3">
                  <Label className="font-semibold dark:text-slate-200">1. Select Target Region</Label>
                  <div className="flex flex-wrap gap-2">
                    {detectedRegions.map(region => {
                      const mappedMaterial = materialMapping[region.name];
                      const isZeroArea = region.area_sqft === 0;

                      return (
                        <Button 
                          key={region.name} 
                          disabled={isZeroArea}
                          variant="outline" 
                          size="sm" 
                          className={`h-auto py-1.5 px-3 text-left flex flex-col items-start transition-all ${
                            activeRegion === region.name 
                              ? 'bg-slate-200 border-slate-400 shadow-inner dark:bg-slate-700 dark:border-slate-500 dark:text-white' 
                              : mappedMaterial 
                                ? 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300' 
                                : 'bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                          } ${isZeroArea ? 'opacity-50 cursor-not-allowed' : ''}`} 
                          onClick={() => setActiveRegion(region.name)}
                        >
                          <span className="text-xs font-semibold">{region.name} ({region.area_sqft} sqft)</span>
                          {mappedMaterial && (
                            <span className={`text-[10px] font-medium ${
                              activeRegion === region.name 
                                ? 'text-slate-600 dark:text-slate-300' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              ↳ {mappedMaterial}
                            </span>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Apply Material */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Label className="font-semibold dark:text-slate-200">2. Apply Material</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MATERIAL_CATALOG.map(material => (
                      <Button 
                        key={material} 
                        variant="outline" 
                        className={`text-xs h-9 transition-all ${
                          activeRegion && materialMapping[activeRegion] === material 
                            ? 'bg-slate-200 border-slate-400 font-bold shadow-inner dark:bg-slate-700 dark:border-slate-500 dark:text-white' 
                            : 'bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`} 
                        disabled={!activeRegion || isAnalyzing} 
                        onClick={() => handleMaterialSelect(material)}
                      >
                        {material}
                      </Button>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>

          </div>

          <div className="col-span-1 lg:col-span-5 space-y-6 h-full">
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900 h-full flex flex-col transition-colors duration-300">
              <CardHeader>
                <CardTitle className="dark:text-white">Detailed Cost Breakdown</CardTitle>
                <CardDescription className="dark:text-slate-400">Adjust market rates to recalculate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 flex-1 flex flex-col">
                
                {estimateData.lineItems.length === 0 ? (
                  <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg text-sm border border-dashed border-slate-200 dark:border-slate-700">
                    Map materials to regions to generate an estimate.
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col flex-1">
                    
                    <div id="cost-breakdown-scroll" className="max-h-[500px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                      {estimateData.lineItems.map((item, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.region} <span className="text-slate-400 dark:text-slate-500 font-normal">| {item.material}</span></span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{item.totalCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="block mb-1">Est. Quantity</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">{item.quantity} {item.unit}</span>
                              <span className="block text-[10px] mt-0.5 opacity-70">Inc. {item.wastagePct}% wastage</span>
                            </div>
                            <div>
                              <span className="block mb-1">Rate / Unit (₹)</span>
                              <Input 
                                type="number" 
                                value={customRates[item.material]} 
                                onChange={(e) => handleRateChange(item.material, e.target.value)}
                                className="h-7 w-20 text-xs px-2 rounded bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:bg-white dark:focus:bg-slate-800 transition-colors"
                              />
                            </div>
                            <div className="pt-2 border-t border-slate-50 dark:border-slate-800/50">
                              <span className="block mb-1">Material Cost</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">₹{item.materialCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-50 dark:border-slate-800/50">
                              <span className="block mb-1">Labor Cost</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">₹{item.laborCost.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between pt-4 text-xl font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-800">
                        <span>Grand Total</span>
                        <span className="text-emerald-600 dark:text-emerald-400">₹{estimateData.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                    </div>


                    <Button 
                      className="w-full bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white shadow-sm mt-4" 
                      disabled={isAnalyzing || isGeneratingVisual}
                      onClick={handleGenerateVisualization}
                    >
                      {isGeneratingVisual ? "Rendering AI Redesign..." : "Generate Visualization"}
                    </Button>
                    
                    <Button 
                      id="download-btn"
                      variant="outline" 
                      className="w-full flex items-center justify-center gap-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" 
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