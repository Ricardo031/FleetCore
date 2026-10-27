--
-- PostgreSQL database dump
--

\restrict AHu2hc5408mBvJQ1MSprwNqeywVAnjYzIxrp18LTCMt6L7hdEIB35uB9zPL9LXQ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: maintenances_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenances_status_enum AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: maintenances_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.maintenances_type_enum AS ENUM (
    'PREVENTIVE',
    'CORRECTIVE'
);


--
-- Name: mechanics_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mechanics_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.users_role_enum AS ENUM (
    'ADMIN',
    'TECHNICIAN'
);


--
-- Name: vehicles_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicles_status_enum AS ENUM (
    'AVAILABLE',
    'IN_MAINTENANCE',
    'INACTIVE'
);


--
-- Name: workshops_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workshops_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: maintenances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenances (
    id integer NOT NULL,
    type public.maintenances_type_enum NOT NULL,
    description text NOT NULL,
    mileage integer NOT NULL,
    "scheduledAt" timestamp with time zone NOT NULL,
    "scheduledEndAt" timestamp with time zone NOT NULL,
    status public.maintenances_status_enum DEFAULT 'SCHEDULED'::public.maintenances_status_enum NOT NULL,
    "workDone" text,
    "finalCost" numeric(12,2),
    "finishedAt" timestamp with time zone,
    "finalMileage" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "vehicleId" integer NOT NULL,
    "mechanicId" integer NOT NULL,
    "workshopId" integer NOT NULL
);


--
-- Name: maintenances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maintenances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maintenances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maintenances_id_seq OWNED BY public.maintenances.id;


--
-- Name: mechanics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mechanics (
    id integer NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    specialty character varying NOT NULL,
    status public.mechanics_status_enum DEFAULT 'ACTIVE'::public.mechanics_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" integer
);


--
-- Name: mechanics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mechanics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mechanics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mechanics_id_seq OWNED BY public.mechanics.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role public.users_role_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    plate character varying NOT NULL,
    brand character varying NOT NULL,
    model character varying NOT NULL,
    year integer NOT NULL,
    mileage integer NOT NULL,
    status public.vehicles_status_enum DEFAULT 'AVAILABLE'::public.vehicles_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: workshops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workshops (
    id integer NOT NULL,
    name character varying NOT NULL,
    address character varying NOT NULL,
    status public.workshops_status_enum DEFAULT 'ACTIVE'::public.workshops_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: workshops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workshops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workshops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workshops_id_seq OWNED BY public.workshops.id;


--
-- Name: maintenances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenances ALTER COLUMN id SET DEFAULT nextval('public.maintenances_id_seq'::regclass);


--
-- Name: mechanics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mechanics ALTER COLUMN id SET DEFAULT nextval('public.mechanics_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Name: workshops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshops ALTER COLUMN id SET DEFAULT nextval('public.workshops_id_seq'::regclass);


--
-- Data for Name: maintenances; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.maintenances VALUES (1, 'PREVENTIVE', 'Cambio de aceite y filtros', 45000, '2026-09-15 14:00:00+00', '2026-09-15 16:00:00+00', 'COMPLETED', 'Cambio de aceite y filtros', 350000.00, '2026-09-15 16:30:00+00', 45050, '2026-10-27 16:16:34.313022', '2026-10-27 16:16:34.313022', 1, 1, 1);
INSERT INTO public.maintenances VALUES (2, 'CORRECTIVE', 'Reemplazo de pastillas de freno', 78000, '2026-10-26 13:00:00+00', '2026-10-26 15:00:00+00', 'IN_PROGRESS', NULL, NULL, NULL, NULL, '2026-10-27 16:16:34.318457', '2026-10-27 16:16:34.318457', 3, 2, 1);


--
-- Data for Name: mechanics; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.mechanics VALUES (1, 'Carlos Pérez', 'carlos@fleetcore.com', 'Motor', 'ACTIVE', '2026-10-27 16:16:34.293642', '2026-10-27 16:16:34.293642', 3);
INSERT INTO public.mechanics VALUES (2, 'Laura Gómez', 'laura@fleetcore.com', 'Frenos', 'ACTIVE', '2026-10-27 16:16:34.296727', '2026-10-27 16:16:34.296727', 4);
INSERT INTO public.mechanics VALUES (3, 'Pedro Ruiz', 'pedro@fleetcore.com', 'Electricidad', 'INACTIVE', '2026-10-27 16:16:34.298445', '2026-10-27 16:16:34.298445', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (1, 'Ricar', 'ricar@gmail.com', '$2b$10$rM9lLQf14mYJU.lBdFxWwuqMeL4Xwr/C5M4CcyXfyGJQat/0Nkx.G', 'ADMIN', '2026-10-27 15:23:39.382668', '2026-10-27 15:23:39.382668');
INSERT INTO public.users VALUES (2, 'Admin', 'admin@fleetcore.com', '$2b$10$HSFl13PCIEe3B.pKy0luhOKPkzSMMH0OHqEyPs1ma9hF1tSbsMnXi', 'ADMIN', '2026-10-27 16:16:34.180392', '2026-10-27 16:16:34.180392');
INSERT INTO public.users VALUES (3, 'Carlos Pérez', 'tech1@fleetcore.com', '$2b$10$5Q/FSlHuG8HO4l/S/YWqPOQJrOT.kfzBp/VF8TCJRzJ5o9C9cstIu', 'TECHNICIAN', '2026-10-27 16:16:34.237684', '2026-10-27 16:16:34.237684');
INSERT INTO public.users VALUES (4, 'Laura Gómez', 'tech2@fleetcore.com', '$2b$10$F9rVmwBTGU0OZMPBBujLX.nTtBR6gsmmX9ec2/NNi8/WfYW9G36du', 'TECHNICIAN', '2026-10-27 16:16:34.290575', '2026-10-27 16:16:34.290575');


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vehicles VALUES (1, 'ABC123', 'Chevrolet', 'NPR', 2020, 45050, 'AVAILABLE', '2026-10-27 16:16:34.304368', '2026-10-27 16:16:34.304368');
INSERT INTO public.vehicles VALUES (2, 'DEF456', 'Renault', 'Logan', 2022, 12000, 'AVAILABLE', '2026-10-27 16:16:34.306828', '2026-10-27 16:16:34.306828');
INSERT INTO public.vehicles VALUES (3, 'GHI789', 'Hino', '300', 2019, 78000, 'IN_MAINTENANCE', '2026-10-27 16:16:34.308323', '2026-10-27 16:16:34.308323');
INSERT INTO public.vehicles VALUES (4, 'JKL012', 'Isuzu', 'NKR', 2015, 150000, 'INACTIVE', '2026-10-27 16:16:34.309679', '2026-10-27 16:16:34.309679');


--
-- Data for Name: workshops; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.workshops VALUES (1, 'Taller Centro', 'Calle 45 # 20-10', 'ACTIVE', '2026-10-27 16:16:34.299957', '2026-10-27 16:16:34.299957');
INSERT INTO public.workshops VALUES (2, 'Taller Sur', 'Carrera 8 # 3-50', 'INACTIVE', '2026-10-27 16:16:34.301712', '2026-10-27 16:16:34.301712');


--
-- Name: maintenances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.maintenances_id_seq', 2, true);


--
-- Name: mechanics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mechanics_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 4, true);


--
-- Name: workshops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.workshops_id_seq', 2, true);


--
-- Name: vehicles PK_18d8646b59304dce4af3a9e35b6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY (id);


--
-- Name: mechanics PK_2c0ed23afc0cc7ff361c17e53df; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mechanics
    ADD CONSTRAINT "PK_2c0ed23afc0cc7ff361c17e53df" PRIMARY KEY (id);


--
-- Name: maintenances PK_62403473bd524a42d58589aa78b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenances
    ADD CONSTRAINT "PK_62403473bd524a42d58589aa78b" PRIMARY KEY (id);


--
-- Name: workshops PK_6d0e82a124f5b53df91c8989848; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workshops
    ADD CONSTRAINT "PK_6d0e82a124f5b53df91c8989848" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: mechanics REL_85c0da75e5dedc5eca00055cfb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mechanics
    ADD CONSTRAINT "REL_85c0da75e5dedc5eca00055cfb" UNIQUE ("userId");


--
-- Name: mechanics UQ_301c3b5fa2d49aab65dcfda36a6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mechanics
    ADD CONSTRAINT "UQ_301c3b5fa2d49aab65dcfda36a6" UNIQUE (email);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: vehicles UQ_ec7181ebdab798d97070122a5bf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT "UQ_ec7181ebdab798d97070122a5bf" UNIQUE (plate);


--
-- Name: maintenances FK_3a9ba7c05e1ffba00560d11f364; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenances
    ADD CONSTRAINT "FK_3a9ba7c05e1ffba00560d11f364" FOREIGN KEY ("mechanicId") REFERENCES public.mechanics(id) ON DELETE RESTRICT;


--
-- Name: maintenances FK_75331cd2a0f0c22bcb2fc4f6d6a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenances
    ADD CONSTRAINT "FK_75331cd2a0f0c22bcb2fc4f6d6a" FOREIGN KEY ("workshopId") REFERENCES public.workshops(id) ON DELETE RESTRICT;


--
-- Name: mechanics FK_85c0da75e5dedc5eca00055cfbe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mechanics
    ADD CONSTRAINT "FK_85c0da75e5dedc5eca00055cfbe" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: maintenances FK_daa193fdfccde41a2ed4de8a474; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenances
    ADD CONSTRAINT "FK_daa193fdfccde41a2ed4de8a474" FOREIGN KEY ("vehicleId") REFERENCES public.vehicles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict AHu2hc5408mBvJQ1MSprwNqeywVAnjYzIxrp18LTCMt6L7hdEIB35uB9zPL9LXQ

