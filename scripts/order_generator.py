import json
import random

def generate_orders(num_orders=10):
    orders = []
    for _ in range(num_orders):
        order = {
            "client_id": random.randint(1, 140),
            "event_id": random.randint(1, 140),
            "order_id": random.randint(1, 100000)
        }
        orders.append(order)
    return orders

def main():
    num_orders_to_generate = 222
    orders = generate_orders(num_orders_to_generate)
    print(json.dumps(orders, indent=4))

if __name__ == "__main__":
    main()