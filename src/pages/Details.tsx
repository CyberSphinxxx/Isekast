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
      <div className="relative z-10 pt-[30vh] px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Poster */}
        <div className="w-64 shrink-0 rounded-lg overflow-hidden shadow-2xl border border-border/50 bg-card">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/400px-Image_created_with_a_mobile_phone.png" 
            alt="Poster" 
            className="w-full aspect-[2/3] object-cover"
          />
        </div>

        {/* Metadata */}
        <div className="flex-1 space-y-6 pt-4">
          <h1 className="text-5xl font-bold text-foreground">Frieren: Beyond Journey's End</h1>
          
          <div className="flex gap-2 flex-wrap">
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Fantasy</span>
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Adventure</span>
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm font-medium">Drama</span>
          </div>

          <p className="text-lg text-foreground/80 leading-relaxed max-w-3xl">
            After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude. Generations pass, and the elven mage Frieren comes face to face with humanity’s mortality.
          </p>

          <div className="flex gap-4">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors">
              <Play className="w-5 h-5 fill-current" />
              Watch Episode 1
            </button>
            <button className="flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-semibold hover:bg-secondary/80 transition-colors">
              <Plus className="w-5 h-5" />
              Add to Library
            </button>
          </div>
        </div>
      </div>

      {/* Episodes List */}
      <div className="relative z-10 px-8 mt-16 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Episodes</h2>
        <div className="space-y-2">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg hover:bg-card border border-transparent hover:border-border transition-colors cursor-pointer group">
              <div className="text-muted-foreground w-8 text-center font-medium">{i + 1}</div>
              <div className="w-32 h-20 bg-muted rounded overflow-hidden relative shrink-0">
                 <img 
                   src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" 
                   alt={`Thumbnail ${i + 1}`}
                   className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                 />
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <Play className="w-8 h-8 text-white drop-shadow-md" />
                 </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Episode Title {i + 1}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">A brief description of this episode's plot goes here.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
