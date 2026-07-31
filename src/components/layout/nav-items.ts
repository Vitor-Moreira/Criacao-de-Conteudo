import {
  LayoutDashboard,
  Lightbulb,
  Users,
  UserSearch,
  Library,
  Sparkles,
  FileEdit,
  Building2,
  TrendingUp,
  CalendarDays,
  Bookmark,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Buscar Ideias por Tema", href: "/ideias", icon: Lightbulb },
  { title: "Perfis de Referência", href: "/perfis", icon: Users },
  { title: "Buscar Criadores", href: "/descobrir-criadores", icon: UserSearch },
  { title: "Banco de Conteúdos", href: "/banco-de-conteudos", icon: Library },
  { title: "Estúdio de Geração", href: "/estudio", icon: Sparkles },
  { title: "Melhorar Conteúdo", href: "/melhorar-conteudo", icon: FileEdit },
  { title: "Clientes", href: "/clientes", icon: Building2 },
  { title: "Pesquisa de Mercado", href: "/pesquisa-mercado", icon: TrendingUp },
  { title: "Calendário Editorial", href: "/calendario", icon: CalendarDays },
  { title: "Coleções/Favoritos", href: "/colecoes", icon: Bookmark },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
];
