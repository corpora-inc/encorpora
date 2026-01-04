// app/components/ContactSection.tsx
import { FC } from "react";
import { FaHandshake, FaBook, FaLaptop, FaGraduationCap, FaEnvelope, FaPhone } from "react-icons/fa";
import { motion } from "framer-motion";

const SERVICES = [
  {
    title: "Custom Books",
    description: "Beautiful educational materials crafted specifically for your curriculum and goals.",
    icon: <FaBook className="text-white text-lg" />,
  },
  {
    title: "Learning Solutions",
    description: "Seamless, interactive learning experiences tailored to every need - digital or print.",
    icon: <FaGraduationCap className="text-white text-lg" />,

  },
  {
    title: "Software Development",
    description: "Modern, robust, and efficient educational software built to order.",
    icon: <FaLaptop className="text-white text-lg" />,
  },
];

const ContactSection: FC = () => (
  <section className="py-6 relative overflow-hidden">
    <div className="container max-w-5xl mx-auto px-6 relative z-10">
      <div className="text-center mb-16">
        {/* Icon */}
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mb-6"
          initial={{ scale: 0, rotate: -180 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{
            type: "spring",
            stiffness: 200,
            duration: 0.8,
          }}
        >
          <FaHandshake className="text-white text-2xl" />
        </motion.div>

        <motion.h2
          className="text-3xl md:text-4xl font-bold mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Consulting & Partnerships
        </motion.h2>

        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <p className="text-xl font-medium mb-4">
            We create <span className="font-bold">custom books, next-gen learning solutions, and tailored software</span> for schools, companies, and innovators.
          </p>
          <p className="text-gray-600 mb-12">
            Whether you want a partnership in education technology or a fully custom learning experience, our team can help you build something exceptional.
          </p>
        </motion.div>

        {/* Services grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.5,
            delay: 0.5,
            staggerChildren: 0.1,
          }}
        >
          {SERVICES.map(({ title, description, icon }, index) => (
            <motion.div
              key={index}
              className={`
                p-8 bg-white rounded-2xl relative flex flex-col items-start
                border-t border-l border-gray-200
                border-b-4 border-r-4 border-black
                transition-all duration-300
              `}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <div className="absolute top-0 right-0 w-12 h-12 bg-black -mt-4 -mr-4 flex items-center justify-center rounded-full shadow-lg">
                {icon}
              </div>
              <h3 className="text-xl font-bold mb-4">{title}</h3>
              <p className="text-gray-600">{description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Contact information */}
        <motion.div
          className="inline-flex flex-col sm:flex-row gap-8 items-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.9 }}
        >
          <motion.a
            href="mailto:team@encorpora.io"
            className="group flex items-center gap-3 text-lg font-medium relative overflow-hidden px-6 py-3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="absolute inset-0 bg-black/5 rounded-lg transform origin-left group-hover:scale-x-100 scale-x-0 transition-transform duration-300"></span>
            <FaEnvelope className="relative z-10" />
            <span className="relative z-10">team@encorpora.io</span>
          </motion.a>
          <motion.a
            href="tel:+17703765331"
            className="group flex items-center gap-3 text-lg font-medium relative overflow-hidden px-6 py-3"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="absolute inset-0 bg-black/5 rounded-lg transform origin-left group-hover:scale-x-100 scale-x-0 transition-transform duration-300"></span>
            <FaPhone className="relative z-10" />
            <span className="relative z-10">770-376-5331</span>
          </motion.a>
        </motion.div>
      </div>
    </div>
  </section>
);

export default ContactSection;
