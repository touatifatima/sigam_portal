import React from "react";
import Navbar from "@/pages/navbar/Navbar";

type InvestorLayoutProps = {
  children: React.ReactNode;
};

export const InvestorLayout = ({ children }: InvestorLayoutProps) => {
  return (
    <div>
      <Navbar />
      {children}
    </div>
  );
};

export default InvestorLayout;
