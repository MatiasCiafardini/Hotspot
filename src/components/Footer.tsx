import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, Phone } from "lucide-react";
import logo from "@/assets/logo-smash.png";

export function Footer() {
  return (
    <footer className="border-t-[4px] border-ink bg-ink text-cream">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
        <div>
          <img src={logo} alt="SMASH" className="h-16 w-auto" />
          <p className="mt-3 text-sm text-cream/70">
            Hamburguesas honestas, sabor de barrio. Hechas con bronca y amor.
          </p>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">Menú</h4>
          <ul className="space-y-1 text-sm text-cream/80">
            <li><Link to="/menu" className="hover:text-primary-glow">Hamburguesas</Link></li>
            <li><Link to="/menu" className="hover:text-primary-glow">Sides</Link></li>
            <li><Link to="/menu" className="hover:text-primary-glow">Bebidas</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">El spot</h4>
          <ul className="space-y-2 text-sm text-cream/80">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Av. Siempre Viva 742</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +54 9 11 5555 5555</li>
            <li className="flex items-center gap-2"><Instagram className="h-4 w-4" /> @smashburgers</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xl mb-3">Horarios</h4>
          <ul className="space-y-1 text-sm text-cream/80">
            <li>Mié–Dom: 19:00 a 02:00</li>
            <li>Lun–Mar: cerrado (descansamos)</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/20 px-4 py-4 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} SMASH. Todos los derechos rebeldes.
      </div>
    </footer>
  );
}
