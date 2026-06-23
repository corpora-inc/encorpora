"use client";

import { FC } from "react";
import { Hero } from "@/components/Hero";
import { AboutSection } from "@/components/AboutSection";
import WhySection from "@/components/WhySection";
import FeaturedApps from "@/components/FeaturedApp";
import FeaturedBooks from "@/components/FeaturedBooks";
import YouTubeSection from "@/components/YouTubeSection";
import Features from "@/components/Features";
import ContactSection from "@/components/Contact";

const HomePage: FC = () => {
  return (
    <>
      <Hero />
      <AboutSection />
      <WhySection />
      <FeaturedApps />
      <FeaturedBooks />
      <YouTubeSection />
      <Features />
      <ContactSection />
    </>
  );
};

export default HomePage;
