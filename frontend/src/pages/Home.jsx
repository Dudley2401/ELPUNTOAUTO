import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Hero from "@/components/sections/Hero";
import Services from "@/components/sections/Services";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import About from "@/components/sections/About";
import Brands from "@/components/sections/Brands";
import Gallery from "@/components/sections/Gallery";
import Testimonials from "@/components/sections/Testimonials";
import Booking from "@/components/sections/Booking";
import Contact from "@/components/sections/Contact";

export default function Home() {
  return (
    <div data-testid="home-page" className="bg-[#0A0A0A] text-white min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Brands />
        <Services />
        <WhyChooseUs />
        <About />
        <Gallery />
        <Testimonials />
        <Booking />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
