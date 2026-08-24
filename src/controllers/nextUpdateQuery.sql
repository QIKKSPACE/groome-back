CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

ALTER TABLE vendors
ADD COLUMN geo_location geography(Point, 4326);


CREATE INDEX vendors_geo_idx
ON vendors
USING GIST (geo_location);

ALTER TABLE vendors
ADD COLUMN delivery_radius_km FLOAT DEFAULT 10;



CREATE TABLE services_main (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  category_id id REFERENCES services(id), -- correct (parent)
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  discount_price NUMERIC(10,2),
  duration_minutes INT DEFAULT 60,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services_main(id),
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================
-- VENDORS BASE SETTINGS
-- =========================
CREATE TABLE vendor_settings (
  vendor_id UUID PRIMARY KEY REFERENCES vendors(id),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  open_time TIME NOT NULL,           
  close_time TIME NOT NULL,          
  weekly_off_days SMALLINT[] NOT NULL DEFAULT ARRAY[]::smallint[], 
  auto_generate_slots BOOLEAN NOT NULL DEFAULT true,
  employee_count INTEGER NOT NULL DEFAULT 1, -- capacity
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);




-- =========================
-- ONE-TIME CLOSED DAYS
-- =========================
CREATE TABLE closed_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  day_date DATE NOT NULL,           
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_closed_days_vendor_date 
ON closed_days(vendor_id, day_date);


-- =========================
-- MULTI-DAY HOLIDAYS
-- =========================
CREATE TABLE holiday_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_holiday_ranges_vendor 
ON holiday_ranges(vendor_id, start_date, end_date);


-- =========================
-- EXTRA WORKING HOURS / OVERTIME
-- =========================
CREATE TABLE overtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  day_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_overtimes_vendor_date 
ON overtimes(vendor_id, day_date);


-- =========================
-- CONFIRMED BOOKINGS
-- =========================
CREATE TABLE confirmed_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_id UUID NULL,             
  user_id UUID NULL,                
  employee_slot SMALLINT NOT NULL DEFAULT 1, -- 1 means takes 1 employee capacity
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts   TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,          
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | completed | cancelled
  metadata JSONB DEFAULT '{}'::jsonb, 
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE confirmed_bookings
ALTER COLUMN service_id TYPE UUID[]
USING ARRAY[service_id]::UUID[];
-- ❗ NOTE: We removed overlap EXCLUSION because we allow multiple bookings.
-- Capacity constraint must be validated in application logic or with a trigger.

CREATE INDEX idx_bookings_vendor_date
ON confirmed_bookings (vendor_id, slot_date);

CREATE INDEX idx_bookings_timerange
ON confirmed_bookings (start_ts, end_ts);
-- =========================
-- TEMPORARY RESERVATIONS
-- =========================
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  service_id UUID NULL,
  user_id UUID NULL,
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,
  employee_slot SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'held', -- held | expired | cancelled | converted
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reservations_vendor_date 
ON reservations(vendor_id, slot_date);



GRANT USAGE, SELECT ON SEQUENCE packages_id_seq TO aurameter_user;

 
 CREATE TABLE creators (
 id SERIAL PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 number VARCHAR(50) NOT NULL,
 description TEXT NOT NULL,
 price NUMERIC(10,2) NOT NULL,
 video_url TEXT,
 created_at TIMESTAMP DEFAULT NOW(),
 updated_at TIMESTAMP DEFAULT NOW()
 );

GRANT USAGE, SELECT ON SEQUENCE creators_id_seq TO aurameter_user;

-----NEXT PART-----
CREATE TABLE vendor_product_categories (
    vendor_id UUID NOT NULL,
    category_id UUID NOT NULL,

    PRIMARY KEY (vendor_id, category_id),

    FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE,

    FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE CASCADE
);

CREATE TABLE mall_product_categories (
    mall_id UUID NOT NULL,
    category_id UUID NOT NULL,

    PRIMARY KEY (mall_id, category_id),

    FOREIGN KEY (mall_id)
        REFERENCES malls(id)
        ON DELETE CASCADE,

    FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE CASCADE
);
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    mall_id UUID,

    category_id UUID,
    sub_category_id UUID,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    price NUMERIC(12,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,

    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'draft')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_mall
        FOREIGN KEY (mall_id)
        REFERENCES malls(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_product_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_product_subcategory
        FOREIGN KEY (sub_category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
);
CREATE TABLE product_images (
    id BIGSERIAL PRIMARY KEY,

    product_id UUID NOT NULL,

    image_url TEXT NOT NULL,

    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_image_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
);

ALTER TABLE products
ADD COLUMN selling_price NUMERIC(10,2);

ALTER TABLE vendors
ADD COLUMN shop_act_number VARCHAR(100);

ALTER TABLE vendors
ADD COLUMN profile_image TEXT;

ALTER TABLE categories
ADD COLUMN platform_commission NUMERIC(10,2) DEFAULT 0;

ALTER TABLE vendors
ADD COLUMN why_choose_us JSONB DEFAULT '[]'::jsonb;

CREATE TABLE blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    blocked_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_slots_vendor_date
ON blocked_slots(vendor_id, blocked_date);

ALTER TABLE products
ADD COLUMN quality_tier VARCHAR(50);
ALTER TABLE services_main
ADD COLUMN quality_tier VARCHAR(50);

ALTER TABLE services
ADD COLUMN affiliate_commission NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE products
ADD COLUMN product_code VARCHAR(100);
ALTER TABLE vendors
ADD COLUMN delay_time_minutes INTEGER DEFAULT 0,
ADD COLUMN is_delay_active BOOLEAN DEFAULT FALSE;

ALTER TABLE influencers
DROP COLUMN content_type;

ALTER TABLE influencers
ADD COLUMN content_types TEXT[];

ALTER TABLE vendor_settings
ADD COLUMN slot_duration INTEGER NOT NULL DEFAULT 30;

ALTER TABLE users
ADD COLUMN affiliate_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE banners
ADD COLUMN link_url TEXT;

-- 1. COUNTRIES
CREATE TABLE countries (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10), -- e.g. 'IN', 'US'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STATES
CREATE TABLE states (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_id INT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_state_per_country UNIQUE (country_id, name)
);

-- 3. CITIES
CREATE TABLE cities (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    state_id INT NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_city_per_state UNIQUE (state_id, name)
);

-- 4. TEHSILS (Sub-Districts)
CREATE TABLE tehsils (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id INT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tehsil_per_city UNIQUE (city_id, name)
);

-- 5. PINCODES
CREATE TABLE pincodes (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tehsil_id INT NOT NULL REFERENCES tehsils(id) ON DELETE CASCADE,
    pincode VARCHAR(15) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pincode_per_tehsil UNIQUE (tehsil_id, pincode)
);

-- Performance Indexes for Cascading Dropdowns & Search
CREATE INDEX idx_states_country_id ON states(country_id);
CREATE INDEX idx_cities_state_id ON cities(state_id);
CREATE INDEX idx_tehsils_city_id ON tehsils(city_id);
CREATE INDEX idx_pincodes_tehsil_id ON pincodes(tehsil_id);
CREATE INDEX idx_pincodes_code ON pincodes(pincode);



CREATE TABLE advertisement_locations (
    id BIGSERIAL PRIMARY KEY,

    advertisement_id BIGINT NOT NULL
        REFERENCES advertisements(id)
        ON DELETE CASCADE,
target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('pincode', 'tehsil', 'city', 'state', 'country')),
    country VARCHAR(100) ,

    state VARCHAR(100),

    city VARCHAR(100),

    pincode VARCHAR(20),
    tehsil varchar(100),
    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
);

CREATE TABLE advertisements (
    id BIGSERIAL PRIMARY KEY,

    advertiser_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(255),

    banner_url TEXT NOT NULL,

    target_link TEXT ,

    position VARCHAR(30) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    status VARCHAR(30)
        NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

    CHECK (end_date >= start_date)
);


CREATE INDEX idx_adv_loc_pincode ON advertisement_locations(pincode) WHERE target_type = 'pincode';
CREATE INDEX idx_adv_loc_city ON advertisement_locations(city) WHERE target_type = 'city';
CREATE INDEX idx_adv_loc_state ON advertisement_locations(state) WHERE target_type = 'state';
CREATE INDEX idx_adv_loc_country ON advertisement_locations(country) WHERE target_type = 'country';


CREATE INDEX idx_adv_loc_advertisement_id ON advertisements(advertiser_id);


ALTER TABLE products
DROP CONSTRAINT IF EXISTS fk_product_mall;

ALTER TABLE products
DROP COLUMN IF EXISTS mall_id;

-- 2. Add seller type
ALTER TABLE products
ADD COLUMN seller_type VARCHAR(20)
NOT NULL DEFAULT 'VENDOR';

-- 3. Restrict allowed values
ALTER TABLE products
ADD CONSTRAINT products_seller_type_check
CHECK (seller_type IN ('VENDOR', 'MANUFACTURER'));

-- Backfill all existing products
UPDATE products
SET seller_type = 'VENDOR'
WHERE seller_type IS NULL;

-- Set default for future inserts
ALTER TABLE products
ALTER COLUMN seller_type SET DEFAULT 'VENDOR';

-- Make it required
ALTER TABLE products
ALTER COLUMN seller_type SET NOT NULL;


ALTER TABLE manufacturers
ADD COLUMN profile_image TEXT;

ALTER TABLE refresh_tokens
ADD COLUMN user_type TEXT NOT NULL DEFAULT 'USER';


ALTER TABLE products

ADD COLUMN brand_name VARCHAR(255),
ADD COLUMN available_sizes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN available_colors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN weight VARCHAR(50),
ADD COLUMN dimensions VARCHAR(100),
ADD COLUMN specifications JSONB DEFAULT '[]'::jsonb;

ALTER TABLE products
ADD COLUMN moq INTEGER,
ADD COLUMN moq_price NUMERIC(10,2);