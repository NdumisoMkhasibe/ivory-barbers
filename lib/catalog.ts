export const TIME_ZONE = "Africa/Johannesburg";
export const LOCATION = "Lower Main Road area, Observatory, Cape Town, 7925, South Africa";
export const SERVICES = [
  { id: "chiskop", name: "Chiskop", price: 150, duration: 45, description: "A clean, close shave. Includes a complimentary beard cut or trim.", image: "/images/services/chiskop.png" },
  { id: "brush", name: "Brush Cut", price: 150, duration: 45, description: "A neat, even short style. Includes a complimentary beard cut or trim.", image: "/images/services/brush.png" },
  { id: "fade", name: "Fade Cut", price: 150, duration: 45, description: "A precision fade. Includes a complimentary beard cut or trim.", image: "/images/services/fade.png" },
  { id: "trim", name: "Trim", price: 100, duration: 30, description: "Remove extra hair and tighten hairstyle and beard lines.", image: "/images/services/trim.png" },
  { id: "beard", name: "Beard", price: 100, duration: 15, description: "A beard cut, shape and clean edges.", image: "/images/services/beard.png" },
  { id: "custom", name: "Custom Cut", price: 180, duration: 60, description: "Your own style, from a photo shown in person or your description.", image: "/images/services/custom%20cut.png" },
] as const;

export const BARBERS = [
  { id: "kylie", name: "Kylie", image: "/images/team/Kylie.png", description: "Thoughtful details, clean shapes and an easy conversation. All menu styles." },
  { id: "pro", name: "Pro", image: "/images/team/PRO.png", description: "Sharp lines and a fresh perspective on your everyday style. All menu styles." },
  { id: "steve", name: "Steve", image: "/images/team/Steve.png", description: "A relaxed chair, considered finishing and a look that feels like you. All menu styles." },
] as const;

export type ServiceId = typeof SERVICES[number]["id"];
export type BarberId = typeof BARBERS[number]["id"];
export type BarberChoice = BarberId | "first-available";

export const getService = (id: string) => SERVICES.find((service) => service.id === id);
export const getBarber = (id: string) => BARBERS.find((barber) => barber.id === id);
