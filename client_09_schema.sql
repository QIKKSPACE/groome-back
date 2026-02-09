--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: aurameter; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA aurameter;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    image_url text NOT NULL,
    file_url text,
    file_name character varying(255),
    file_type character varying(100),
    is_active boolean DEFAULT true,
    "position" character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT banners_position_check CHECK ((("position")::text = ANY ((ARRAY['top'::character varying, 'middle'::character varying, 'bottom'::character varying, 'sidebar'::character varying, 'service'::character varying])::text[])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    parent_id uuid,
    image_url text,
    sort_order integer DEFAULT 1,
    commission numeric(5,2) DEFAULT 0.0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug character varying(255)
);


--
-- Name: city_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city_lists (
    id integer NOT NULL,
    city_name character varying(100) NOT NULL
);


--
-- Name: city_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.city_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: city_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.city_lists_id_seq OWNED BY public.city_lists.id;


--
-- Name: closed_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closed_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    day_date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: confirmed_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.confirmed_bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    service_id uuid[],
    user_id uuid,
    employee_slot smallint DEFAULT 1 NOT NULL,
    start_ts timestamp with time zone NOT NULL,
    end_ts timestamp with time zone NOT NULL,
    slot_date date NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: creators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creators (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    number character varying(50) NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    video_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: creators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.creators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: creators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.creators_id_seq OWNED BY public.creators.id;


--
-- Name: delivery_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rider_name character varying(255) NOT NULL,
    address text NOT NULL,
    zip_code character varying(6) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    dl_number character varying(50),
    dl_image text,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL
);


--
-- Name: franchise_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchise_types (
    id integer NOT NULL,
    franchise_type character varying(100) NOT NULL
);


--
-- Name: franchise_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.franchise_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: franchise_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.franchise_types_id_seq OWNED BY public.franchise_types.id;


--
-- Name: franchises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    address text NOT NULL,
    zip_code character varying(6) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL,
    franchise_type_id integer NOT NULL
);


--
-- Name: holiday_ranges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holiday_ranges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: influencer_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.influencer_videos (
    id integer NOT NULL,
    influencer_id integer NOT NULL,
    video_url text NOT NULL,
    title character varying(255),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: influencer_videos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.influencer_videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: influencer_videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.influencer_videos_id_seq OWNED BY public.influencer_videos.id;


--
-- Name: influencers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.influencers (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    instagram_profile character varying(255) NOT NULL,
    state character varying(50) NOT NULL,
    content_type character varying(50) NOT NULL,
    languages text[] NOT NULL,
    profile_picture_url text,
    about_you character varying(1000),
    consent boolean DEFAULT false NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    show_on_frontend boolean DEFAULT false NOT NULL,
    booking_price numeric(10,2) DEFAULT NULL::numeric
);


--
-- Name: influencers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.influencers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: influencers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.influencers_id_seq OWNED BY public.influencers.id;


--
-- Name: malls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.malls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address text NOT NULL,
    pincode character varying(6) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL,
    business_name character varying(150) DEFAULT 'new_business'::character varying NOT NULL,
    company_doc text,
    map_address text,
    place_id character varying(255),
    latitude double precision,
    longitude double precision,
    company_id character varying(255)
);


--
-- Name: manufacturer_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturer_categories (
    manufacturer_id uuid NOT NULL,
    category_id uuid NOT NULL
);


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address text NOT NULL,
    business_name character varying(255) NOT NULL,
    zip_code character varying(6) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL,
    company_doc text,
    company_id character varying(255)
);


--
-- Name: overtimes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtimes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    day_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    offer text NOT NULL,
    price numeric(10,2) NOT NULL,
    discount numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    code character varying(50),
    start_date date NOT NULL,
    end_date date NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT promotions_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::text[]))),
    CONSTRAINT promotions_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT promotions_usage_limit_check CHECK ((usage_limit > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: service_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid,
    image_url text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    commission numeric(5,2) DEFAULT 0.00 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image_url character varying(255)
);


--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: services_main; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services_main (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid,
    category_id integer,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    discount_price numeric(10,2),
    duration_minutes integer DEFAULT 60,
    status text DEFAULT 'active'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT services_main_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: superadmins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.superadmins (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: superadmins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.superadmins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: superadmins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.superadmins_id_seq OWNED BY public.superadmins.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(15) NOT NULL,
    password text NOT NULL,
    role character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    latitude numeric(10,7),
    longitude numeric(10,7),
    is_affiliate boolean DEFAULT true NOT NULL,
    affiliate_code character varying(50),
    parent_affiliate uuid,
    otp character varying(6),
    firebase_uid character varying(128)
);


--
-- Name: vendor_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_services (
    vendor_id uuid NOT NULL,
    service_id integer NOT NULL
);


--
-- Name: vendor_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_settings (
    vendor_id uuid NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL,
    weekly_off_days smallint[] DEFAULT ARRAY[]::smallint[] NOT NULL,
    auto_generate_slots boolean DEFAULT true NOT NULL,
    employee_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address text NOT NULL,
    pincode character varying(6) NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL,
    business_name character varying(150) DEFAULT 'new_business'::character varying NOT NULL,
    gst_number character varying(50),
    company_doc text,
    gst_doc text,
    map_address text,
    place_id character varying(255),
    latitude double precision,
    longitude double precision,
    company_id character varying(255),
    geo_location public.geography(Point,4326),
    delivery_radius_km double precision DEFAULT 10
);


--
-- Name: city_lists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_lists ALTER COLUMN id SET DEFAULT nextval('public.city_lists_id_seq'::regclass);


--
-- Name: creators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators ALTER COLUMN id SET DEFAULT nextval('public.creators_id_seq'::regclass);


--
-- Name: franchise_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_types ALTER COLUMN id SET DEFAULT nextval('public.franchise_types_id_seq'::regclass);


--
-- Name: influencer_videos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencer_videos ALTER COLUMN id SET DEFAULT nextval('public.influencer_videos_id_seq'::regclass);


--
-- Name: influencers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencers ALTER COLUMN id SET DEFAULT nextval('public.influencers_id_seq'::regclass);


--
-- Name: packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: superadmins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins ALTER COLUMN id SET DEFAULT nextval('public.superadmins_id_seq'::regclass);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: city_lists city_lists_city_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_lists
    ADD CONSTRAINT city_lists_city_name_key UNIQUE (city_name);


--
-- Name: city_lists city_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_lists
    ADD CONSTRAINT city_lists_pkey PRIMARY KEY (id);


--
-- Name: closed_days closed_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_days
    ADD CONSTRAINT closed_days_pkey PRIMARY KEY (id);


--
-- Name: confirmed_bookings confirmed_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confirmed_bookings
    ADD CONSTRAINT confirmed_bookings_pkey PRIMARY KEY (id);


--
-- Name: creators creators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_pkey PRIMARY KEY (id);


--
-- Name: delivery_partners delivery_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_pkey PRIMARY KEY (id);


--
-- Name: delivery_partners delivery_partners_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_user_id_key UNIQUE (user_id);


--
-- Name: franchise_types franchise_types_franchise_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_types
    ADD CONSTRAINT franchise_types_franchise_type_key UNIQUE (franchise_type);


--
-- Name: franchise_types franchise_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_types
    ADD CONSTRAINT franchise_types_pkey PRIMARY KEY (id);


--
-- Name: franchises franchises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchises
    ADD CONSTRAINT franchises_pkey PRIMARY KEY (id);


--
-- Name: holiday_ranges holiday_ranges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holiday_ranges
    ADD CONSTRAINT holiday_ranges_pkey PRIMARY KEY (id);


--
-- Name: influencer_videos influencer_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencer_videos
    ADD CONSTRAINT influencer_videos_pkey PRIMARY KEY (id);


--
-- Name: influencers influencers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencers
    ADD CONSTRAINT influencers_pkey PRIMARY KEY (id);


--
-- Name: malls malls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malls
    ADD CONSTRAINT malls_pkey PRIMARY KEY (id);


--
-- Name: manufacturer_categories manufacturer_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturer_categories
    ADD CONSTRAINT manufacturer_categories_pkey PRIMARY KEY (manufacturer_id, category_id);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_user_id_key UNIQUE (user_id);


--
-- Name: overtimes overtimes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtimes
    ADD CONSTRAINT overtimes_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: service_images service_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_images
    ADD CONSTRAINT service_images_pkey PRIMARY KEY (id);


--
-- Name: services_main services_main_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_main
    ADD CONSTRAINT services_main_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: superadmins superadmins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins
    ADD CONSTRAINT superadmins_email_key UNIQUE (email);


--
-- Name: superadmins superadmins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins
    ADD CONSTRAINT superadmins_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_services vendor_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_pkey PRIMARY KEY (vendor_id, service_id);


--
-- Name: vendor_settings vendor_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_settings
    ADD CONSTRAINT vendor_settings_pkey PRIMARY KEY (vendor_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_key UNIQUE (user_id);


--
-- Name: idx_bookings_timerange; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_timerange ON public.confirmed_bookings USING btree (start_ts, end_ts);


--
-- Name: idx_bookings_vendor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_vendor_date ON public.confirmed_bookings USING btree (vendor_id, slot_date);


--
-- Name: idx_closed_days_vendor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_closed_days_vendor_date ON public.closed_days USING btree (vendor_id, day_date);


--
-- Name: idx_holiday_ranges_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holiday_ranges_vendor ON public.holiday_ranges USING btree (vendor_id, start_date, end_date);


--
-- Name: idx_overtimes_vendor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overtimes_vendor_date ON public.overtimes USING btree (vendor_id, day_date);


--
-- Name: malls_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX malls_user_id_key ON public.malls USING btree (user_id);


--
-- Name: vendors_geo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_geo_idx ON public.vendors USING gist (geo_location);


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: closed_days closed_days_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_days
    ADD CONSTRAINT closed_days_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: confirmed_bookings confirmed_bookings_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.confirmed_bookings
    ADD CONSTRAINT confirmed_bookings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: delivery_partners delivery_partners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: influencer_videos fk_influencer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencer_videos
    ADD CONSTRAINT fk_influencer FOREIGN KEY (influencer_id) REFERENCES public.influencers(id) ON DELETE CASCADE;


--
-- Name: users fk_parent_affiliate; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_parent_affiliate FOREIGN KEY (parent_affiliate) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: franchises franchises_franchise_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchises
    ADD CONSTRAINT franchises_franchise_type_id_fkey FOREIGN KEY (franchise_type_id) REFERENCES public.franchise_types(id) ON DELETE CASCADE;


--
-- Name: franchises franchises_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchises
    ADD CONSTRAINT franchises_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: holiday_ranges holiday_ranges_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holiday_ranges
    ADD CONSTRAINT holiday_ranges_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: influencers influencers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.influencers
    ADD CONSTRAINT influencers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: malls malls_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.malls
    ADD CONSTRAINT malls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: manufacturer_categories manufacturer_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturer_categories
    ADD CONSTRAINT manufacturer_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: manufacturer_categories manufacturer_categories_manufacturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturer_categories
    ADD CONSTRAINT manufacturer_categories_manufacturer_id_fkey FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id) ON DELETE CASCADE;


--
-- Name: manufacturers manufacturers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: overtimes overtimes_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtimes
    ADD CONSTRAINT overtimes_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_images service_images_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_images
    ADD CONSTRAINT service_images_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services_main(id);


--
-- Name: services_main services_main_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_main
    ADD CONSTRAINT services_main_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: services_main services_main_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_main
    ADD CONSTRAINT services_main_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_services vendor_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: vendor_services vendor_services_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_services
    ADD CONSTRAINT vendor_services_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_settings vendor_settings_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_settings
    ADD CONSTRAINT vendor_settings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: vendors vendors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

