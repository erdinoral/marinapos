import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { CategoryPage } from "./pages/CategoryPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderConfirmPage } from "./pages/OrderConfirmPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AccountPage } from "./pages/AccountPage";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { GuideDetailPage, GuideListPage } from "./pages/GuidePages";
import { AuthConfirmPage } from "./pages/AuthConfirmPage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              {/* E-posta dogrulama / sifre sifirlama — net, tek odakli sayfa */}
              <Route path="uyelik-onay" element={<AuthConfirmPage />} />
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="kategori/:slug" element={<CategoryPage />} />
                <Route path="urun/:slug" element={<ProductPage />} />
                <Route path="sepet" element={<CartPage />} />
                <Route path="odeme" element={<CheckoutPage />} />
                <Route path="siparis-onay" element={<OrderConfirmPage />} />
                <Route path="giris" element={<LoginPage />} />
                <Route path="uye-ol" element={<RegisterPage />} />
                <Route path="hesabim" element={<AccountPage />} />
                <Route path="hakkimizda" element={<AboutPage />} />
                <Route path="iletisim" element={<ContactPage />} />
                <Route path="rehber" element={<GuideListPage />} />
                <Route path="rehber/:slug" element={<GuideDetailPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
