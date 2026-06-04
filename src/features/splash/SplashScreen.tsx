import { motion } from "framer-motion";
import logoSrc from "../../assets/marina-logo.png";

const easeOut = [0.16, 1, 0.3, 1] as const;

export function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-ambient" aria-hidden>
        <motion.div
          className="splash-orb splash-orb--a"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: easeOut }}
        />
        <motion.div
          className="splash-orb splash-orb--b"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.35, ease: easeOut, delay: 0.12 }}
        />
        <motion.div
          className="splash-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.07 }}
          transition={{ duration: 1, delay: 0.2 }}
        />
      </div>

      <motion.div
        className="splash-content"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.14, delayChildren: 0.05 }
          }
        }}
      >
        <motion.div
          className="splash-logo-wrap"
          variants={{
            hidden: { opacity: 0, y: 28, scale: 0.92, rotateX: 12 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              rotateX: 0,
              transition: { type: "spring", stiffness: 320, damping: 26, mass: 0.85 }
            }
          }}
          style={{ transformPerspective: 920 }}
        >
          <motion.div
            className="splash-logo-shine"
            aria-hidden
            initial={{ left: "-45%" }}
            animate={{ left: "145%" }}
            transition={{ duration: 3.2, ease: easeOut, delay: 0.42 }}
          />
          <motion.div
            className="splash-logo-ring"
            aria-hidden
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          />
          <motion.img
            src={logoSrc}
            alt="Marina Nargile logo"
            className="splash-logo"
            draggable={false}
            variants={{
              hidden: { opacity: 0, scale: 0.94, filter: "blur(8px)" },
              visible: {
                opacity: 1,
                scale: 1,
                filter: "blur(0px)",
                transition: { duration: 0.65, ease: easeOut }
              }
            }}
          />
          <motion.div
            className="splash-logo-glow"
            aria-hidden
            animate={{
              opacity: [0.35, 0.65, 0.45],
              scale: [0.98, 1.02, 1]
            }}
            transition={{ duration: 2.2, ease: "easeInOut", times: [0, 0.55, 1] }}
          />
        </motion.div>

        <motion.div
          className="splash-title-block"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.02 } }
          }}
        >
          <motion.p
            className="splash-subtitle"
            variants={{
              hidden: { opacity: 0, y: 14, letterSpacing: "0.38em" },
              visible: {
                opacity: 1,
                y: 0,
                letterSpacing: "0.22em",
                transition: { duration: 0.75, ease: easeOut }
              }
            }}
          >
            Marina Nargile POS
          </motion.p>
          <motion.div
            className="splash-underline"
            variants={{
              hidden: { scaleX: 0 },
              visible: {
                scaleX: 1,
                transition: { duration: 0.85, ease: easeOut, delay: 0.12 }
              }
            }}
            aria-hidden
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
