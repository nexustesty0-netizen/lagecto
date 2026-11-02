-- Live catalog prices for Thabi, Kristen, and Sandra.

UPDATE public.subscription_plans SET price = 4.50 WHERE package_key = 'thabi' AND duration_key = '1_month';
UPDATE public.subscription_plans SET price = 11.00 WHERE package_key = 'thabi' AND duration_key = '3_months';
UPDATE public.subscription_plans SET price = 21.00 WHERE package_key = 'thabi' AND duration_key = '6_months';
UPDATE public.subscription_plans SET price = 30.00 WHERE package_key = 'thabi' AND duration_key = '9_months';
UPDATE public.subscription_plans SET price = 38.00 WHERE package_key = 'thabi' AND duration_key = '1_year';

UPDATE public.subscription_plans SET price = 6.50 WHERE package_key = 'kristen' AND duration_key = '1_month';
UPDATE public.subscription_plans SET price = 16.00 WHERE package_key = 'kristen' AND duration_key = '3_months';
UPDATE public.subscription_plans SET price = 30.00 WHERE package_key = 'kristen' AND duration_key = '6_months';
UPDATE public.subscription_plans SET price = 44.00 WHERE package_key = 'kristen' AND duration_key = '9_months';
UPDATE public.subscription_plans SET price = 55.00 WHERE package_key = 'kristen' AND duration_key = '1_year';

UPDATE public.subscription_plans SET price = 8.00 WHERE package_key = 'sandra' AND duration_key = '1_month';
UPDATE public.subscription_plans SET price = 20.00 WHERE package_key = 'sandra' AND duration_key = '3_months';
UPDATE public.subscription_plans SET price = 37.50 WHERE package_key = 'sandra' AND duration_key = '6_months';
UPDATE public.subscription_plans SET price = 54.00 WHERE package_key = 'sandra' AND duration_key = '9_months';
UPDATE public.subscription_plans SET price = 67.00 WHERE package_key = 'sandra' AND duration_key = '1_year';
