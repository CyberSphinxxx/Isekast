import { Play, Plus } from "lucide-react";

export default function Details() {
  return (
    <div className="relative min-h-screen pb-16">
      {/* Hero Banner */}
      <div className="absolute top-0 left-0 right-0 h-[60vh] w-full">
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png" 
          alt="Banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* Content Split */}
      <div className="relative z-10 pt-[40vh] px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-10">
        {/* Poster */}
        <div className="w-72 shrink-0 rounded-lg overflow-hidden shadow-2xl border border-border/50 bg-card -mt-24">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/400px-Image_created_with_a_mobile_phone.png" 
            alt="Poster" 
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        {/* Metadata */}
        <div className="flex-1 space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground drop-shadow-sm tracking-tight">Frieren: Beyond Journey's End</h1>
          
          <div className="flex gap-2 flex-wrap">
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Fantasy</span>
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Adventure</span>
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Drama</span>
          </div>

          <p className="text-lg text-foreground/80 leading-relaxed max-w-3xl">
            After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude. Generations pass, and the elven mage Frieren comes face to face with humanity’s mortality.
          </p>

          <div className="flex gap-4 pt-2">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-full font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25">
              <Play className="w-5 h-5 fill-current" />
              Play / Read
            </button>
            <button className="flex items-center gap-2 bg-transparent text-foreground border-2 border-border px-8 py-3 rounded-full font-semibold hover:bg-accent hover:text-accent-foreground hover:border-transparent transition-all">
              <Plus className="w-5 h-5" />
              Add to Library
            </button>
          </div>
        </div>
      </div>

      {/* Episodes List */}
      <div className="relative z-10 px-8 mt-20 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Episodes</h2>
        <div className="space-y-2">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 border border-transparent transition-colors cursor-pointer group">
              <div className="text-muted-foreground w-8 text-center font-medium text-lg">{i + 1}</div>
              <div className="w-40 h-24 bg-muted rounded-md overflow-hidden relative shrink-0 shadow-sm">
                 <img 
                   src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" 
                   alt={`Thumbnail ${i + 1}`}
                   className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                 />
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="w-10 h-10 text-white drop-shadow-md fill-white" />
                 </div>
                 {/* Progress Bar */}
                 <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                   <div className="h-full bg-primary" style={{ width: i === 0 ? '60%' : i === 1 ? '15%' : '0%' }}></div>
                 </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">Episode Title {i + 1}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">A brief description of this episode's plot goes here. This gives some context about what happens in the episode.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
