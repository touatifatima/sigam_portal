import React from "react";
import Navbar from "@/pages/navbar/Navbar";

type InvestorLayoutProps = {
  children: React.ReactNode;
  hideNavbar?: boolean;
};

export const InvestorLayout = ({ children, hideNavbar = false }: InvestorLayoutProps) => {
  return (
    <div>
      {!hideNavbar && <Navbar />}
      {children}
    </div>
  );
};

export default InvestorLayout;
