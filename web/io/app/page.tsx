"use client";

import { FC } from "react";
import { Hero } from "@/components/Hero";
import { AboutSection } from "@/components/AboutSection";
import ContactSection from "@/components/Contact";
import FeaturedBooks from "@/components/FeaturedBooks";
import WhySection from "@/components/WhySection";
import Features from "@/components/Features";
import FeaturedApps from "@/components/FeaturedApp";

const HomePage: FC = () => {
  return (
    <>
      <Hero />
      <AboutSection />
      <WhySection />
      <Features />
      <FeaturedApps />
      <FeaturedBooks />
      <ContactSection />
    </>
  );
};

export default HomePage;