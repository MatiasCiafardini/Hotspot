import { Instagram, MapPin, Phone } from "lucide-react";
import logo from "@/assets/logo_hotspot.png";
import { TransitionLink } from "@/components/RouteTransitionProvider";

export function Footer() {
  return (
    <footer className="border-t border-ink bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div>
          <img src={logo} alt="SMASH" className="h-16 w-auto" />
          <p className="mt-3 text-sm text-foreground/70">
            Hamburguesas honestas, sabor de barrio. Hechas con bronca y amor.
          </p>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">Menú</h4>
          <ul className="space-y-1 text-sm text-foreground/80">
            <li><TransitionLink to="/menu" className="hover:text-primary-glow">Hamburguesas</TransitionLink></li>
            <li><TransitionLink to="/menu" className="hover:text-primary-glow">Sides</TransitionLink></li>
            <li><TransitionLink to="/menu" className="hover:text-primary-glow">Bebidas</TransitionLink></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">El spot</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <a
                href="https://www.google.com/maps/@-34.2522477,-59.4757485,3a,75y,266.71h,67.93t/data=!3m7!1e1!3m5!1sybKhR0fvntCwY3Qheb8IPg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D22.06998740067975%26panoid%3DybKhR0fvntCwY3Qheb8IPg%26yaw%3D266.71433393466685!7i16384!8i8192?entry=ttu&g_ep=EgoyMDI2MDQyMi4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <MapPin className="h-4 w-4 shrink-0" /> Aristobulo del Valle 498
              </a>
            </li>
            <li>
              <a href="tel:+5492326494882" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="h-4 w-4 shrink-0" /> +54 9 2326 49-4882
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/hotspot_pupi/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Instagram className="h-4 w-4 shrink-0" /> @hotspot_pupi
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">Horarios</h4>
          <ul className="space-y-1 text-sm text-foreground/80">
            <li>Mié–Dom: 19:00 a 02:00</li>
            <li>Lun–Mar: cerrado (descansamos)</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-foreground/20 px-4 py-4 text-center text-xs text-foreground/50">
        © {new Date().getFullYear()} SMASH. Todos los derechos rebeldes.
      </div>
    </footer>
  );
}
